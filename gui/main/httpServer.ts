import http from "http";
import { cwd } from "process";
import { readFile, stat } from "fs/promises";
import { join, extname, resolve, relative } from "path";
import { log } from "./logger";

// Import the same storage functions used by IPC handlers
import { listSessions, readSessionInfo, createSession, deleteSessionInfo, touchSession, closeSession, updateSessionInfo } from "../../storage/sessionIndex";
import { readTranscriptMessages, deleteTranscript, getTranscriptPath } from "../../storage/transcript";
import { listTasks, readTaskInfo, createTask, updateTaskInfo, deleteTaskInfo, getUnblockedTasks, addTaskComment, evaluateCondition } from "../../storage/taskIndex";
import { listProposals, readProposal, createProposal, updateProposal, deleteProposal, approveProposal } from "../../storage/proposalIndex";
import { listDocuments, readDocument, createDocument, updateDocument, deleteDocument } from "../../storage/documentIndex";
import { listWorkflows, readWorkflow, deleteWorkflow, saveWorkflow, parseWorkflowYaml, importWorkflowAsProposal, proposalToWorkflowYaml } from "../../storage/workflowIndex";
import { listAgents, readAgentInfo, createAgent, updateAgentInfo, deleteAgentInfo } from "../../storage/agentIndex";
import { createId } from "../../shared/ids";
import { eventBus } from "../../shared/eventBus";

type RouteHandler = (req: http.IncomingMessage, body: string, params?: Record<string, string>) => Promise<unknown>;

const routes = new Map<string, RouteHandler>();

// ====== Helper ======

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", (err) => reject(err));
  });
}

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// Validate that a file path is within the working directory (prevent path traversal)
function validateFilePath(filePath: string, baseDir: string): string {
  const resolved = resolve(baseDir, filePath);
  const rel = relative(baseDir, resolved);
  if (rel.startsWith("..") || resolve(baseDir, rel) !== resolved) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }
  return resolved;
}

// ====== Sessions ======

routes.set("GET /api/sessions", async () => {
  return { sessions: await listSessions(cwd()) };
});

routes.set("GET /api/sessions/:id", async (_req, _body, params?: Record<string, string>) => {
  const session = await readSessionInfo(cwd(), params!.id!);
  if (!session) return { error: "Not found" };
  const messages = await readTranscriptMessages(cwd(), params!.id!).catch(() => []);
  return { session, messages };
});

routes.set("DELETE /api/sessions/:id", async (_req, _body, params?: Record<string, string>) => {
  const sid = params!.id!;
  await deleteSessionInfo(cwd(), sid);
  await deleteTranscript(cwd(), sid).catch(() => {});
  // Delete all tasks associated with this session
  try {
    const allTasks = await listTasks(cwd());
    const sessionTasks = allTasks.filter(t => t.sessionId === sid);
    for (const t of sessionTasks) {
      await deleteTaskInfo(cwd(), t.id).catch(() => {});
    }
  } catch {}
  return { ok: true };
});

routes.set("POST /api/sessions/:id/heartbeat", async (_req, _body, params?: Record<string, string>) => {
  await touchSession(cwd(), params!.id!);
  return { ok: true };
});

routes.set("POST /api/sessions/:id/close", async (_req, _body, params?: Record<string, string>) => {
  await closeSession(cwd(), params!.id!);
  return { ok: true };
});

routes.set("PATCH /api/sessions/:id", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const sessionId = params!.id!;
  const session = await readSessionInfo(cwd(), sessionId);
  if (!session) return { error: "Session not found" };

  const { writeFile } = await import("fs/promises");
  const { getSessionInfoFilePath } = await import("../../storage/sessionIndex");
  const updated = {
    ...session,
    ...(input.status && { status: input.status }),
    updatedAt: new Date().toISOString(),
  };
  await writeFile(getSessionInfoFilePath(cwd(), sessionId), JSON.stringify(updated, null, 2), "utf8");
  return { ok: true };
});

routes.set("GET /api/sessions/:id/messages", async (_req, _body, params?: Record<string, string>) => {
  const messages = await readTranscriptMessages(cwd(), params!.id!).catch(() => []);
  return { messages };
});

// ====== Tasks ======

routes.set("GET /api/tasks", async () => {
  return { tasks: await listTasks(cwd()) };
});

routes.set("GET /api/tasks/:id", async (_req, _body, params?: Record<string, string>) => {
  const task = await readTaskInfo(cwd(), params!.id!);
  return { task };
});

routes.set("POST /api/tasks", async (_req, body) => {
  const input = JSON.parse(body);
  const task = await createTask(cwd(), {
    id: createId("task"),
    title: input.title,
    description: input.description,
    priority: input.priority || "medium",
    status: "todo",
    assignee: input.assignee,
    dependsOn: input.dependsOn,
    createdBy: input.createdBy,
  });
  return { task };
});

routes.set("PATCH /api/tasks/:id", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const task = await updateTaskInfo(cwd(), params!.id!, input, input.actor);
  return { task };
});

routes.set("DELETE /api/tasks/:id", async (_req, _body, params?: Record<string, string>) => {
  await deleteTaskInfo(cwd(), params!.id!);
  return { ok: true };
});

routes.set("POST /api/tasks/:id/comment", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const task = await addTaskComment(cwd(), params!.id!, input.comment, input.actor);
  return { task };
});

routes.set("POST /api/tasks/:id/assign", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const taskId = params!.id!;
  const assignee = input.assignee || "general-purpose";
  const task = await updateTaskInfo(cwd(), taskId, { assignee, status: "in_progress" }, input.actor);

  // Trigger execution in background (mirrors IPC handler behavior)
  executingTasks.add(taskId);
  executeTaskViaHttp(taskId).finally(() => {
    executingTasks.delete(taskId);
  });

  return { task };
});

routes.set("POST /api/tasks/:id/release", async (_req, _body, params?: Record<string, string>) => {
  const task = await updateTaskInfo(cwd(), params!.id!, { assignee: null }, "user");
  return { task };
});

routes.set("GET /api/tasks/unblocked", async () => {
  return { tasks: await getUnblockedTasks(cwd()) };
});

routes.set("POST /api/tasks/:id/claim", async (_req, body, params?: Record<string, string>) => {
  const input = body ? JSON.parse(body) : {};
  const task = await updateTaskInfo(cwd(), params!.id!, { status: "in_progress" }, input.actor);
  return { task };
});

routes.set("POST /api/tasks/:id/complete", async (_req, body, params?: Record<string, string>) => {
  const input = body ? JSON.parse(body) : {};
  const task = await updateTaskInfo(cwd(), params!.id!, { status: "done" }, input.actor);
  return { task };
});

routes.set("POST /api/tasks/:id/fail", async (_req, body, params?: Record<string, string>) => {
  const input = body ? JSON.parse(body) : {};
  const task = await updateTaskInfo(cwd(), params!.id!, { status: "failed", lastError: input.error }, input.actor);
  return { task };
});

routes.set("POST /api/tasks/:id/submit-verify", async (_req, body, params?: Record<string, string>) => {
  const input = body ? JSON.parse(body) : {};
  const task = await updateTaskInfo(cwd(), params!.id!, { status: "verify" }, input.actor);
  return { task };
});

// Execute a task via SSE (runs agent and streams results)
routes.set("POST /api/tasks/:id/execute", async (_req, _body, _params) => {
  // Handled specially in the server (SSE)
  return { _sse: true };
});

// Resolve approval: execute now, later, or abort (also handles task_failure and checkpoint)
routes.set("POST /api/tasks/:id/approve", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const taskId = params!.id!;
  const action = input.action as 'execute' | 'later' | 'abort' | 'continue' | 'retry' | 'stop';

  if (!action || !['execute', 'later', 'abort', 'continue', 'retry', 'stop'].includes(action)) {
    return { error: "action must be 'execute', 'later', 'abort', 'continue', 'retry', or 'stop'" };
  }

  const pendingReq = pendingApprovalTasks.get(taskId);
  
  // Don't delete for later action - we want to re-prompt
  if (action !== 'later') {
    pendingApprovalTasks.delete(taskId);
    approvalEmittedAt.delete(taskId);
  }

  // Handle task failure decisions
  if (pendingReq?.requestType === 'task_failure') {
    eventBus.emit("approval:resolved", { taskId, action });

    if (action === 'retry') {
      // Retry: reset task to todo and re-execute
      log("INFO", "AutoExec", `Retrying failed task ${taskId}`);
      await updateTaskInfo(cwd(), taskId, { status: "todo", lastError: null });
      executingTasks.add(taskId);
      executeTaskViaHttp(taskId).finally(() => {
        executingTasks.delete(taskId);
      });
      return { ok: true, action: "retry" };
    }

    if (action === 'continue' || action === 'execute') {
      // Continue: mark as failed (was paused), trigger downstream tasks
      log("INFO", "AutoExec", `Continuing after failed task ${taskId}`);
      await updateTaskInfo(cwd(), taskId, { status: "failed" });
      await assignDependentTasks(taskId);
      eventBus.emit("executor:task-completed", { taskId, success: false, result: pendingReq.errorMessage });
      return { ok: true, action: action };
    }

    // stop/abort: mark as failed (was paused), don't continue
    log("INFO", "AutoExec", `Stopped after failed task ${taskId}`);
    await updateTaskInfo(cwd(), taskId, { status: "failed" });
    // Cancel all remaining todo tasks in the same session to stop the workflow
    try {
      const stoppedTask = await readTaskInfo(cwd(), taskId);
      const sid = stoppedTask?.sessionId;
      if (sid) {
        const allTasks = await listTasks(cwd());
        const remaining = allTasks.filter(t => t.sessionId === sid && t.status === "todo");
        for (const t of remaining) {
          log("INFO", "AutoExec", `Cancelling remaining task: ${t.title}`);
          await updateTaskInfo(cwd(), t.id, { status: "cancelled", lastError: "Workflow stopped by user" }, "user");
        }
      }
    } catch (e) {
      log("WARN", "AutoExec", `Failed to cancel remaining tasks: ${e}`);
    }
    eventBus.emit("executor:task-completed", { taskId, success: false, result: pendingReq.errorMessage });
    return { ok: true, action: action };
  }

  // Handle normal approval actions
  if (action === 'abort') {
    await updateTaskInfo(cwd(), taskId, { status: "failed", lastError: "Aborted by user" }, "user");
    eventBus.emit("approval:resolved", { taskId, action });
    return { ok: true, action: "abort" };
  }

  if (action === 'later') {
    eventBus.emit("approval:resolved", { taskId, action });
    // Remove from pending so the poll loop stops re-emitting the popup.
    // Task stays 'paused' so the WorkflowRail keeps showing it as a
    // persistent reminder (pulsing dot). User re-opens the approval
    // by clicking the paused node in the rail, not via auto-re-emit.
    pendingApprovalTasks.delete(taskId);
    approvalEmittedAt.delete(taskId);
    return { ok: true, action: "later" };
  }

  // action === 'execute'
  eventBus.emit("approval:resolved", { taskId, action });

  // Check if this is a checkpoint_after confirmation (task paused waiting for confirm)
  const task = await readTaskInfo(cwd(), taskId);
  if (task?.status === 'paused' && task?.checkpointAfter) {
    log("INFO", "AutoExec", `Checkpoint confirmed for task ${taskId}, marking done and triggering downstream`);
    await updateTaskInfo(cwd(), taskId, { status: "done" });
    await assignDependentTasks(taskId);
    return { ok: true, action: "execute" };
  }

  // Normal approval — execute the task
  executingTasks.add(taskId);
  executeTaskViaHttp(taskId).finally(() => {
    executingTasks.delete(taskId);
  });
  return { ok: true, action: "execute" };
});

routes.set("POST /api/tasks/batch", async (_req, body) => {
  const input = JSON.parse(body);
  const createdTasks = [];
  const batchIndexToTaskId = new Map<number, string>();
  for (let i = 0; i < input.tasks.length; i++) {
    const t = input.tasks[i];
    const taskId = createId("task");
    batchIndexToTaskId.set(i, taskId);
    const task = await createTask(cwd(), { id: taskId, title: t.title, description: t.description, priority: t.priority || "medium", status: "todo", assignee: t.assignee, createdBy: input.createdBy });
    createdTasks.push(task);
  }
  for (let i = 0; i < input.tasks.length; i++) {
    const t = input.tasks[i];
    if (t.dependsOnBatchIndex?.length) {
      const deps = t.dependsOnBatchIndex.map((idx: number) => batchIndexToTaskId.get(idx)).filter(Boolean);
      if (deps.length) await updateTaskInfo(cwd(), createdTasks[i].id, { dependsOn: deps }, input.createdBy);
    }
  }
  return { tasks: createdTasks };
});

routes.set("POST /api/tasks/:id/criterion", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const { updateAcceptanceCriterion } = await import("../../storage/taskIndex");
  const task = await updateAcceptanceCriterion(cwd(), params!.id!, input.criterionId, { status: input.status, evidence: input.evidence }, input.actor);
  return { task };
});

// ====== Proposals ======

routes.set("GET /api/proposals", async () => {
  return { proposals: await listProposals(cwd()) };
});

routes.set("GET /api/proposals/:id", async (_req, _body, params?: Record<string, string>) => {
  const proposal = await readProposal(cwd(), params!.id!);
  return { proposal };
});

routes.set("POST /api/proposals", async (_req, body) => {
  const input = JSON.parse(body);
  const proposal = await createProposal(cwd(), {
    id: createId("proposal"),
    title: input.title,
    description: input.description,
    inputType: input.inputType || "manual",
    status: "draft",
    taskDrafts: [],
    documentDrafts: [],
    createdBy: input.createdBy,
  });
  return { proposal };
});

routes.set("PATCH /api/proposals/:id", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const proposal = await updateProposal(cwd(), params!.id!, input);
  return { proposal };
});

routes.set("DELETE /api/proposals/:id", async (_req, _body, params?: Record<string, string>) => {
  await deleteProposal(cwd(), params!.id!);
  return { ok: true };
});

routes.set("DELETE /api/proposals/:id/with-tasks", async (_req, _body, params?: Record<string, string>) => {
  const proposalId = params!.id!;
  const proposal = await readProposal(cwd(), proposalId);
  if (!proposal) return { error: "Proposal not found" };

  // Find tasks created from this proposal (matched by title)
  const draftTitles = new Set(proposal.taskDrafts.map(d => d.title));
  const allTasks = await listTasks(cwd());
  const relatedTasks = allTasks.filter(t => draftTitles.has(t.title));

  let deletedTasks = 0;
  let deletedSessions = 0;

  // Delete related tasks and their sessions
  for (const task of relatedTasks) {
    if (task.sessionId) {
      try {
        await deleteSessionInfo(cwd(), task.sessionId);
        await deleteTranscript(cwd(), task.sessionId);
        deletedSessions++;
      } catch (e) {
        log("WARN", "HTTP", `Failed to delete session ${task.sessionId}: ${e}`);
      }
    }
    try {
      await deleteTaskInfo(cwd(), task.id);
      deletedTasks++;
    } catch (e) {
      log("WARN", "HTTP", `Failed to delete task ${task.id}: ${e}`);
    }
  }

  // Delete the proposal
  await deleteProposal(cwd(), proposalId);

  return { ok: true, deletedTasks, deletedSessions };
});

routes.set("POST /api/proposals/:id/revert", async (_req, _body, params?: Record<string, string>) => {
  const proposalId = params!.id!;
  const proposal = await readProposal(cwd(), proposalId);
  if (!proposal) return { error: "Proposal not found" };

  let deletedTasks = 0;

  // If proposal was approved, delete associated tasks first
  if (proposal.status === 'approved') {
    const draftTitles = new Set(proposal.taskDrafts.map(d => d.title));
    const allTasks = await listTasks(cwd());
    const relatedTasks = allTasks.filter(t => draftTitles.has(t.title));

    for (const task of relatedTasks) {
      if (task.sessionId) {
        try {
          await deleteSessionInfo(cwd(), task.sessionId);
          await deleteTranscript(cwd(), task.sessionId);
        } catch (e) {
          log("WARN", "HTTP", `Revert: failed to delete session ${task.sessionId}: ${e}`);
        }
      }
      try {
        await deleteTaskInfo(cwd(), task.id);
        deletedTasks++;
      } catch (e) {
        log("WARN", "HTTP", `Revert: failed to delete task ${task.id}: ${e}`);
      }
    }
  }

  // Revert status to draft
  const updated = await updateProposal(cwd(), proposalId, { status: 'draft' });
  return { proposal: updated, deletedTasks };
});

routes.set("POST /api/proposals/:id/submit", async (_req, _body, params?: Record<string, string>) => {
  const proposal = await updateProposal(cwd(), params!.id!, { status: "pending" });
  return { proposal };
});

routes.set("POST /api/proposals/:id/approve", async (_req, _body, params?: Record<string, string>) => {
  const result = await approveProposal(cwd(), params!.id!);
  return result;
});

routes.set("POST /api/proposals/:id/reject", async (_req, _body, params?: Record<string, string>) => {
  const proposal = await updateProposal(cwd(), params!.id!, { status: "rejected" });
  return { proposal };
});

routes.set("POST /api/proposals/:id/task-drafts", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const proposal = await readProposal(cwd(), params!.id!);
  if (!proposal) return { error: "Not found" };
  const draftData = input.draft || input;
  // Preserve the original tempId from the editor (needed for dependency resolution)
  const newDraft = { ...draftData, tempId: draftData.tempId || createId("draft") };
  const updated = await updateProposal(cwd(), params!.id!, { taskDrafts: [...proposal.taskDrafts, newDraft] });
  return { proposal: updated };
});

routes.set("DELETE /api/proposals/:id/task-drafts/:tempId", async (_req, _body, params?: Record<string, string>) => {
  const proposal = await readProposal(cwd(), params!.id!);
  if (!proposal) return { error: "Not found" };
  const updated = await updateProposal(cwd(), params!.id!, { taskDrafts: proposal.taskDrafts.filter(d => d.tempId !== params!.tempId) });
  return { proposal: updated };
});

routes.set("PATCH /api/proposals/:id/task-drafts/:tempId", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  // Accept both { updates: {...} } and flat { ... } formats
  const updates = input.updates || input;
  const proposal = await readProposal(cwd(), params!.id!);
  if (!proposal) return { error: "Not found" };
  const taskDrafts = proposal.taskDrafts.map(d =>
    d.tempId === params!.tempId ? { ...d, ...updates } : d
  );
  const updated = await updateProposal(cwd(), params!.id!, { taskDrafts });
  return { proposal: updated };
});

routes.set("POST /api/proposals/:id/document-drafts", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const proposal = await readProposal(cwd(), params!.id!);
  if (!proposal) return { error: "Not found" };
  const draftData = input.draft || input;
  const newDraft = { tempId: createId("doc"), ...draftData };
  const updated = await updateProposal(cwd(), params!.id!, { documentDrafts: [...proposal.documentDrafts, newDraft] });
  return { proposal: updated };
});

routes.set("DELETE /api/proposals/:id/document-drafts/:tempId", async (_req, _body, params?: Record<string, string>) => {
  const proposal = await readProposal(cwd(), params!.id!);
  if (!proposal) return { error: "Not found" };
  const updated = await updateProposal(cwd(), params!.id!, { documentDrafts: proposal.documentDrafts.filter(d => d.tempId !== params!.tempId) });
  return { proposal: updated };
});

routes.set("PATCH /api/proposals/:id/document-drafts/:tempId", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const proposal = await readProposal(cwd(), params!.id!);
  if (!proposal) return { error: "Not found" };
  const documentDrafts = proposal.documentDrafts.map(d =>
    d.tempId === params!.tempId ? { ...d, ...input } : d
  );
  const updated = await updateProposal(cwd(), params!.id!, { documentDrafts });
  return { proposal: updated };
});

// ====== Documents ======

routes.set("GET /api/documents", async () => {
  return { documents: await listDocuments(cwd()) };
});

routes.set("GET /api/documents/:id", async (_req, _body, params?: Record<string, string>) => {
  const document = await readDocument(cwd(), params!.id!);
  return { document };
});

routes.set("POST /api/documents", async (_req, body) => {
  const input = JSON.parse(body);
  const document = await createDocument(cwd(), {
    id: createId("doc"),
    title: input.title,
    type: input.type,
    content: input.content || "",
    proposalId: input.proposalId,
    createdBy: input.createdBy,
  });
  return { document };
});

routes.set("PATCH /api/documents/:id", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const document = await updateDocument(cwd(), params!.id!, input);
  return { document };
});

routes.set("DELETE /api/documents/:id", async (_req, _body, params?: Record<string, string>) => {
  await deleteDocument(cwd(), params!.id!);
  return { ok: true };
});

routes.set("GET /api/documents/:id/is-injected", async (_req, _body, params?: Record<string, string>) => {
  const { isDocInjected } = await import("../../storage/irgMd");
  const injected = await isDocInjected(cwd(), params!.id!);
  return { injected };
});

routes.set("POST /api/documents/:id/toggle-inject", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const { addDocRef, removeDocRef } = await import("../../storage/irgMd");
  if (input.inject) {
    await addDocRef(cwd(), params!.id!);
  } else {
    await removeDocRef(cwd(), params!.id!);
  }
  return { ok: true };
});

// ====== Workflows ======

routes.set("GET /api/workflows", async () => {
  return { workflows: await listWorkflows(cwd()) };
});

// List available YAML files on the remote machine
routes.set("GET /api/workflows/files", async () => {
  const { readdir } = await import("fs/promises");
  const workflowsDir = join(cwd(), "workflows");
  const files: Array<{ name: string; path: string; type: 'workflow' }> = [];
  try {
    const entries = await readdir(workflowsDir);
    for (const entry of entries) {
      if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
        files.push({ name: entry, path: join(workflowsDir, entry), type: 'workflow' });
      }
    }
  } catch {}
  return { files };
});

// Read a YAML file from the remote machine and import it
routes.set("POST /api/workflows/import-remote", async (_req, body) => {
  const input = JSON.parse(body);
  const { readFile: readFileFs } = await import("fs/promises");
  const safePath = validateFilePath(input.filePath, cwd());
  const yaml = await readFileFs(safePath, "utf8");
  const workflow = parseWorkflowYaml(yaml);
  workflow.sourceFile = input.filePath;
  const { proposal } = await importWorkflowAsProposal(cwd(), workflow, input.createdBy, input.filePath);
  return { workflow, proposalId: proposal.id };
});

routes.set("POST /api/workflows/import", async (_req, body) => {
  const input = JSON.parse(body);
  const workflow = parseWorkflowYaml(input.yaml);
  const { proposal } = await importWorkflowAsProposal(cwd(), workflow, input.createdBy);
  return { workflow, proposalId: proposal.id };
});

// ====== Skills ======

routes.set("GET /api/skills", async () => {
  const { listUserSkills } = await import("../../skills/skillManager");
  const skills = await listUserSkills(cwd());
  return { skills };
});

// ====== Agents ======

routes.set("GET /api/agents", async () => {
  return { agents: await listAgents(cwd()) };
});

routes.set("POST /api/agents", async (_req, body) => {
  const input = JSON.parse(body);
  const agent = await createAgent(cwd(), {
    id: createId("agent"),
    name: input.name,
    description: input.description,
    systemPrompt: input.systemPrompt || [],
    allowedTools: input.allowedTools || "*",
    maxTurns: input.maxTurns,
    capabilities: input.capabilities,
    isBuiltIn: false,
  });
  return { agent };
});

routes.set("PATCH /api/agents/:id", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const updates = input.updates || input;
  const agent = await updateAgentInfo(cwd(), params!.id!, updates);
  return { agent };
});

routes.set("DELETE /api/agents/:id", async (_req, _body, params?: Record<string, string>) => {
  const success = await deleteAgentInfo(cwd(), params!.id!);
  return { success };
});

routes.set("GET /api/agents/:id", async (_req, _body, params?: Record<string, string>) => {
  const agent = await readAgentInfo(cwd(), params!.id!);
  return { agent };
});

routes.set("GET /api/agents/by-capability", async (_req, _body) => {
  const { listAgentsByCapability } = await import("../../storage/agentIndex");
  const agents = await listAgentsByCapability(cwd(), "");
  return { agents };
});

routes.set("POST /api/agents/generate", async (_req, body) => {
  // Placeholder — agent generation requires LLM
  return { error: "Agent generation not supported via HTTP API" };
});

// ====== Workflows (extended) ======

routes.set("GET /api/workflows/:id", async (_req, _body, params?: Record<string, string>) => {
  const workflow = await readWorkflow(cwd(), params!.id!);
  return { workflow };
});

routes.set("DELETE /api/workflows/:id", async (_req, _body, params?: Record<string, string>) => {
  await deleteWorkflow(cwd(), params!.id!);
  return { ok: true };
});

routes.set("POST /api/workflows/import-file", async (_req, body) => {
  const input = JSON.parse(body);
  const { readFile: readFileFs } = await import("fs/promises");
  const safePath = validateFilePath(input.filePath, cwd());
  const content = await readFileFs(safePath, "utf8");
  const workflow = parseWorkflowYaml(content);
  workflow.sourceFile = input.filePath;
  const { proposal } = await importWorkflowAsProposal(cwd(), workflow, input.createdBy, input.filePath);
  return { workflow, proposalId: proposal.id };
});

// Import workflow AND immediately create tasks (skip proposal draft)
routes.set("POST /api/workflows/import-and-execute", async (_req, body) => {
  const input = JSON.parse(body);
  const { readFile: readFileFs } = await import("fs/promises");
  let yaml = input.yaml;
  if (input.filePath) {
    const safePath = validateFilePath(input.filePath, cwd());
    yaml = await readFileFs(safePath, "utf8");
  }
  if (!yaml) return { error: "No YAML content provided" };

  const workflow = parseWorkflowYaml(yaml);
  if (input.filePath) workflow.sourceFile = input.filePath;
  await saveWorkflow(cwd(), workflow);

  // Create tasks directly (skip proposal draft)
  const tempIdToTaskId = new Map<string, string>();
  for (const step of workflow.steps) {
    tempIdToTaskId.set(step.id, createId("task"));
  }

  // Validate deps
  for (const step of workflow.steps) {
    if (step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (!tempIdToTaskId.has(depId)) {
          return { error: `Step "${step.id}" depends on unknown step "${depId}"` };
        }
      }
    }
  }

  const createdTasks = [];
  for (const step of workflow.steps) {
    const taskId = tempIdToTaskId.get(step.id)!;
    let description = step.description || "";
    if (step.grpc) {
      description += (description ? "\n\n" : "") + `gRPC: ${step.grpc.service}.${step.grpc.method} @ ${step.grpc.address || "default"}`;
      description += `\nPayload: ${JSON.stringify(step.grpc.payload)}`;
      if (step.grpc.protoFile) description += `\nProto: ${step.grpc.protoFile}`;
    }
    if (step.shell) description += (description ? "\n\n" : "") + `Shell: ${step.shell}`;

    const dependsOn = step.dependsOn?.map(d => tempIdToTaskId.get(d)!).filter(Boolean);

    const task = await createTask(cwd(), {
      id: taskId,
      title: step.name,
      description: description.trim() || undefined,
      priority: "medium",
      status: "todo",
      assignee: step.agent || "grpc-worker",
      dependsOn,
      createdBy: input.createdBy,
    });
    createdTasks.push({ id: taskId, title: step.name, assignee: task.assignee, status: task.status, dependsOn });
  }

  return { workflow: workflow.name, tasks: createdTasks };
});

// ====== Compact Workflow ======

routes.set("POST /api/compact/start", async (_req, body) => {
  const input = JSON.parse(body);
  const { readFile: readFileFs } = await import("fs/promises");

  let yaml;
  if (input.filePath) {
    // Try templates dirs first (.irg/templates and workflows), then validate as path
    const { join: joinPath } = await import("path");
    const candidateDirs = [
      joinPath(cwd(), ".irg", "templates"),
      joinPath(cwd(), "workflows"),
    ];
    for (const dir of candidateDirs) {
      try {
        yaml = await readFileFs(joinPath(dir, input.filePath), "utf8");
        break;
      } catch {
        // try next dir
      }
    }
    if (!yaml) {
      const safePath = validateFilePath(input.filePath, cwd());
      yaml = await readFileFs(safePath, "utf8");
    }
  }
  if (!yaml) return { error: "No filePath provided" };

  // Substitute {{param}} variables with user-provided values (default localhost)
  if (input.params && typeof input.params === 'object') {
    yaml = yaml.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      return input.params[key] != null ? String(input.params[key]) : 'localhost';
    });
  }

  const workflow = parseWorkflowYaml(yaml);
  if (input.filePath) workflow.sourceFile = input.filePath;

  const sessionId = input.sessionId || createId("session");
  if (!input.sessionId) {
    await createSession(cwd(), sessionId, {
      title: `Compact: ${workflow.name}`,
    });
  }

  const tempIdToTaskId = new Map<string, string>();
  for (const step of workflow.steps) {
    tempIdToTaskId.set(step.id, createId("task"));
  }

  for (const step of workflow.steps) {
    if (step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (!tempIdToTaskId.has(depId)) {
          return { error: `Step "${step.id}" depends on unknown step "${depId}"` };
        }
      }
    }
  }

  const createdTasks = [];
  for (const step of workflow.steps) {
    const taskId = tempIdToTaskId.get(step.id)!;
    let description = step.description || "";
    if (step.grpc) {
      description += (description ? "\n\n" : "") + `gRPC: ${step.grpc.service}.${step.grpc.method} @ ${step.grpc.address || "default"}`;
      description += `\nPayload: ${JSON.stringify(step.grpc.payload)}`;
      if (step.grpc.protoFile) description += `\nProto: ${step.grpc.protoFile}`;
    }
    if (step.shell) description += (description ? "\n\n" : "") + `Shell: ${step.shell}`;

    const dependsOn = step.dependsOn?.map((d: string) => tempIdToTaskId.get(d)!).filter(Boolean);

    const taskInput: any = {
      id: taskId,
      title: step.name,
      description: description.trim() || undefined,
      priority: "medium",
      status: "todo",
      assignee: step.agent || "general-purpose",
      dependsOn,
      createdBy: input.createdBy || "compact",
    };

    // Convert condition.source from yaml step id to actual task UUID
    let condition = step.condition;
    if (condition && condition.source) {
      const mappedSource = tempIdToTaskId.get(condition.source);
      condition = { ...condition, source: mappedSource || condition.source };
    }

    // Convert loop.steps from yaml step ids to actual task UUIDs
    let loop = step.loop;
    if (loop && loop.steps) {
      const mappedSteps = loop.steps.map((s: string) => tempIdToTaskId.get(s) || s);
      let mappedUntil = loop.until;
      if (mappedUntil && mappedUntil.source) {
        const untilSource = tempIdToTaskId.get(mappedUntil.source);
        mappedUntil = { ...mappedUntil, source: untilSource || mappedUntil.source };
      }
      loop = { ...loop, steps: mappedSteps, until: mappedUntil };
    }

    if (condition) taskInput.condition = condition;
    if (loop) taskInput.loop = loop;
    if (step.checkpointAfter) {
      taskInput.checkpointAfter = true;
      taskInput.checkpointMessage = step.checkpointMessage;
    }
    if (step.requiresApproval) {
      taskInput.requiresApproval = true;
      taskInput.approvalMessage = step.approvalMessage;
    }
    // Persist structured gRPC config so executeTaskViaHttp can build a precise
    // prompt with exact parameters (rather than relying on the LLM to parse
    // them out of the free-text description). Mirrors workflowIndex.ts behavior.
    if (step.grpc) {
      taskInput.grpcConfig = {
        protoFile: step.grpc.protoFile || "protos/AlgoService.proto",
        service: step.grpc.service,
        method: step.grpc.method,
        address: step.grpc.address || "",
        payload: step.grpc.payload || {},
        metadata: step.grpc.metadata,
        deadline: step.grpc.deadline,
      };
    }

    const task = await createTask(cwd(), taskInput);

    await updateTaskInfo(cwd(), taskId, { sessionId });

    createdTasks.push({
      id: taskId,
      title: step.name,
      assignee: task.assignee,
      status: task.status,
      dependsOn,
      condition,
      loop,
      checkpointAfter: step.checkpointAfter,
      checkpointMessage: step.checkpointMessage,
      requiresApproval: step.requiresApproval,
      approvalMessage: step.approvalMessage,
    });
  }

  return { sessionId, workflow: workflow.name, tasks: createdTasks };
});

// Save proposal as YAML file
routes.set("POST /api/workflows/save-yaml", async (_req, body) => {
  const input = JSON.parse(body);
  const { writeFile: writeFileFs, mkdir: mkdirFs } = await import("fs/promises");

  if (!input.proposal || !input.proposal.title) {
    return { error: "proposal with title is required" };
  }

  const yamlContent = proposalToWorkflowYaml(input.proposal);
  const fileName = (input.fileName || `${input.proposal.title}.yaml`).replace(/[^a-zA-Z0-9._\-\(\)\s]/g, '_');
  const workflowsDir = join(cwd(), "workflows");
  const filePath = validateFilePath(fileName, workflowsDir);

  await mkdirFs(workflowsDir, { recursive: true });
  await writeFileFs(filePath, yamlContent, "utf8");

  return { filePath, fileName };
});

// ====== Plans ======

import { readPlan, createPlan, updatePlan, deletePlan, listPlans, confirmPlan } from "../../storage/planIndex";

routes.set("GET /api/plans", async () => {
  return { plans: await listPlans(cwd()) };
});

routes.set("GET /api/plans/:id", async (_req, _body, params?: Record<string, string>) => {
  const plan = await readPlan(cwd(), params!.id!);
  return { plan };
});

routes.set("POST /api/plans", async (_req, body) => {
  const input = JSON.parse(body);
  const plan = await createPlan(cwd(), { id: createId("plan"), title: input.title, description: input.description, tasks: input.tasks || [], status: "draft", createdBy: input.createdBy });
  return { plan };
});

routes.set("PATCH /api/plans/:id", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const plan = await updatePlan(cwd(), params!.id!, input);
  return { plan };
});

routes.set("DELETE /api/plans/:id", async (_req, _body, params?: Record<string, string>) => {
  await deletePlan(cwd(), params!.id!);
  return { ok: true };
});

routes.set("POST /api/plans/:id/confirm", async (_req, _body, params?: Record<string, string>) => {
  const result = await confirmPlan(cwd(), params!.id!);
  return result;
});

// ====== Templates ======

import { listTemplates, readTemplate, findTemplateByIntent, extractTemplateNodes } from "../../storage/templateIndex";

routes.set("GET /api/templates", async () => {
  const templates = await listTemplates(cwd());
  return { templates: templates.map(t => ({
    id: t.id,
    filename: t.filename,
    name: t.name,
    description: t.description,
    tags: t.tags,
    triggers: t.triggers,
    useCase: t.useCase,
    params: t.params,
  })) };
});

routes.set("GET /api/templates/:id", async (_req, _body, params?: Record<string, string>) => {
  const filename = params!.id!.endsWith(".yaml") ? params!.id! : `${params!.id}.yaml`;
  const template = await readTemplate(cwd(), filename);
  if (!template) return { error: "Template not found" };
  return {
    template: {
      id: template.id,
      filename: template.filename,
      name: template.name,
      description: template.description,
      tags: template.tags,
      triggers: template.triggers,
      useCase: template.useCase,
      params: template.params,
      nodes: extractTemplateNodes(template),
      rawYaml: template.rawYaml,
    }
  };
});

routes.set("POST /api/templates/match", async (_req, body) => {
  const input = JSON.parse(body);
  const message = input.message || "";
  const template = await findTemplateByIntent(cwd(), message);
  if (!template) return { matched: false };
  return {
    matched: true,
    template: {
      id: template.id,
      filename: template.filename,
      name: template.name,
      description: template.description,
      tags: template.tags,
      triggers: template.triggers,
      useCase: template.useCase,
      params: template.params,
      nodes: extractTemplateNodes(template),
      rawYaml: template.rawYaml,
    }
  };
});

// Chat intent recognition: matches user message to template, runs PM enhancement
routes.set("POST /api/chat/intent", async (_req, body) => {
  const input = JSON.parse(body);
  const message = input.message || "";
  if (!message.trim()) return { matched: false };

  const template = await findTemplateByIntent(cwd(), message);
  if (!template) return { matched: false };

  // Ensure LLM config is loaded before PM enhancement
  await initLlmConfig();

  const nodes = extractTemplateNodes(template);
  const enhancement = await enhanceTemplateWithPm(
    template.name,
    template.description,
    nodes,
    message,
  );

  return {
    matched: true,
    template: {
      id: template.id,
      filename: template.filename,
      name: template.name,
      description: template.description,
      tags: template.tags,
      triggers: template.triggers,
      useCase: template.useCase,
      params: template.params,
      nodes,
      rawYaml: template.rawYaml,
    },
    enhancement,
  };
});

// ====== Executor ======

routes.set("POST /api/executor/start", async () => {
  startTaskAutoExec();
  return { ok: true, running: true };
});

routes.set("POST /api/executor/stop", async () => {
  stopTaskAutoExec();
  // Pause all currently running tasks (graceful, resumable)
  for (const [taskId, controller] of taskAbortControllers) {
    log("INFO", "AutoExec", `Pausing running task ${taskId} on executor stop`);
    controller.abort();
    try {
      await updateTaskInfo(cwd(), taskId, { status: "paused" });
    } catch (e) {
      log("ERROR", "AutoExec", `Failed to mark task ${taskId} as paused: ${e}`);
    }
  }
  taskAbortControllers.clear();
  executingTasks.clear();
  return { ok: true, running: false };
});

routes.set("GET /api/executor/status", async () => {
  return { running: taskPollInterval !== null };
});

// ====== Task-level pause / cancel / resume ======

routes.set("POST /api/tasks/:id/pause", async (_req, _body, params?: Record<string, string>) => {
  const taskId = params!.id!;
  const controller = taskAbortControllers.get(taskId);
  if (controller) {
    log("INFO", "AutoExec", `Pausing task ${taskId}`);
    controller.abort();
    taskAbortControllers.delete(taskId);
    executingTasks.delete(taskId);
    await updateTaskInfo(cwd(), taskId, { status: "paused" });
    return { ok: true, status: "paused" };
  }
  return { ok: false, error: "Task not currently running" };
});

routes.set("POST /api/tasks/:id/cancel", async (_req, _body, params?: Record<string, string>) => {
  const taskId = params!.id!;
  const controller = taskAbortControllers.get(taskId);
  if (controller) {
    log("INFO", "AutoExec", `Cancelling running task ${taskId}`);
    controller.abort();
    taskAbortControllers.delete(taskId);
    executingTasks.delete(taskId);
  } else {
    log("INFO", "AutoExec", `Cancelling inactive task ${taskId}`);
  }
  await updateTaskInfo(cwd(), taskId, { status: "cancelled" });
  pendingApprovalTasks.delete(taskId);
  return { ok: true, status: "cancelled" };
});

routes.set("POST /api/tasks/:id/resume", async (_req, _body, params?: Record<string, string>) => {
  const taskId = params!.id!;
  const task = await readTaskInfo(cwd(), taskId);
  if (!task) return { ok: false, error: "Task not found" };
  if (task.status !== "paused") {
    return { ok: false, error: `Task is ${task.status}, not paused` };
  }
  log("INFO", "AutoExec", `Resuming task ${taskId}`);
  await updateTaskInfo(cwd(), taskId, { status: "in_progress" });
  executingTasks.add(taskId);
  executeTaskViaHttp(taskId).finally(() => {
    executingTasks.delete(taskId);
  });
  return { ok: true, status: "in_progress" };
});

// ====== Config (read-only, API key masked) ======

import { loadConfig, saveConfig, mergeEnvIntoConfig, getDefaultConfig } from "../../runtime/config";

routes.set("GET /api/config", async () => {
  try {
    const config = await loadConfig();
    const merged = mergeEnvIntoConfig(config);
    return {
      llm: {
        ...merged.llm,
        apiKey: merged.llm.apiKey ? "[SET]" : "",
      },
      source: "file",
    };
  } catch {
    return { llm: getDefaultConfig().llm, source: "default" };
  }
});

routes.set("PATCH /api/config", async (_req, body) => {
  // Only allow updating non-sensitive fields via HTTP
  const input = JSON.parse(body);
  const allowed: Record<string, unknown> = {};
  if (input.model) allowed.model = input.model;
  if (input.baseUrl) allowed.baseUrl = input.baseUrl;
  if (input.provider) allowed.provider = input.provider;
  if (input.contextWindow !== undefined && input.contextWindow > 0) allowed.contextWindow = input.contextWindow;
  if (input.maxOutputTokens !== undefined && input.maxOutputTokens > 0) allowed.maxOutputTokens = input.maxOutputTokens;
  // Never allow apiKey to be set via HTTP
  const existing = await loadConfig();
  const updatedConfig = { llm: { ...existing.llm, ...allowed } };
  await saveConfig(updatedConfig);
  return { llm: { ...updatedConfig.llm, apiKey: updatedConfig.llm.apiKey ? "[SET]" : "" }, source: "file" };
});

// ====== Chat (SSE streaming + permission support) ======

import { SessionEngine } from "../../runtime/session";
import { query } from "../../runtime/query";
import { canUseTool } from "../../permissions/engine";
import { createInitialAppState } from "../../runtime/state";
import { initLlmConfig, getLlmConfig } from "../../runtime/llm";
import type { Message, AssistantMessage, ToolResultMessage } from "../../runtime/messages";
import { evolveAfterSession, DEFAULT_EVOLUTION_CONFIG } from "../../runtime/evolution";
import type { ToolUseContext } from "../../tools/Tool";
import type { GrpcClientInput } from "../../tools/grpc/grpcClientTool";

// Pending permission requests for HTTP mode
const httpPermissions = new Map<string, { resolve: (approved: boolean) => void; request: unknown }>();
// Track in-flight chat abort controllers by request id so concurrent chat
// requests don't clobber each other, and so client disconnects can abort
// the running LLM query (freeing tokens/resources).
const httpAbortControllers = new Map<string, AbortController>();

// SSE chat endpoint
function handleChatSse(req: http.IncomingMessage, res: http.ServerResponse, body: string) {
  const input = JSON.parse(body);
  const rawMessage = input.message;
  const sessionId = input.sessionId as string | undefined;

  // Support both string and structured { text, images } format
  const messageText = typeof rawMessage === 'string' ? rawMessage : rawMessage?.text || '';
  const messageImages = typeof rawMessage === 'object' ? rawMessage?.images || [] : [];

  if (!messageText && messageImages.length === 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "message is required" }));
    return;
  }

  // Set up SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send("connected", { status: "ok" });

  // Each chat request gets its own abort controller so concurrent requests
  // and client disconnects can be handled independently.
  const chatReqId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const abortController = new AbortController();
  httpAbortControllers.set(chatReqId, abortController);

  // Forward eventBus tool events as SSE events (like ipcPush.ts does for Electron)
  const onToolStart = (data: any) => send("tool:start", data);
  const onToolResult = (data: any) => send("tool:result", data);
  const onToolError = (data: any) => send("tool:error", data);
  const onToolProgress = (data: any) => send("tool:progress", data);
  const onSessionMessageAppended = (data: any) => send("session:message-appended", data);
  eventBus.on("tool:start", onToolStart);
  eventBus.on("tool:result", onToolResult);
  eventBus.on("tool:error", onToolError);
  eventBus.on("tool:progress", onToolProgress);
  eventBus.on("session:message-appended", onSessionMessageAppended);

  // Clean up listeners when connection closes — also abort the in-flight
  // LLM query so disconnecting the client stops burning tokens.
  res.on("close", () => {
    eventBus.off("tool:start", onToolStart);
    eventBus.off("tool:result", onToolResult);
    eventBus.off("tool:error", onToolError);
    eventBus.off("tool:progress", onToolProgress);
    eventBus.off("session:message-appended", onSessionMessageAppended);
    abortController.abort();
    httpAbortControllers.delete(chatReqId);
  });

  (async () => {
    await initLlmConfig();

    let session: SessionEngine;
    if (sessionId) {
      session = new SessionEngine({ id: sessionId, cwd: cwd() });
      session.hydrateMessages(await readTranscriptMessages(cwd(), sessionId).catch(() => []));
    } else {
      session = new SessionEngine({ id: createId("session"), cwd: cwd() });
    }

    // Build multimodal content if images are present
    const userContent = messageImages.length > 0
      ? [
          ...(messageText ? [{ type: "text" as const, text: messageText }] : []),
          ...messageImages.map((img: { data: string; mimeType: string }) => ({
            type: "image" as const,
            data: img.data,
            mimeType: img.mimeType,
          })),
        ]
      : messageText;

    const userMsg: Message = { id: createId("user"), type: "user", content: userContent };
    await session.recordMessages([userMsg]);
    // Send full content (including images) so frontend can render them
    send("message", { id: userMsg.id, role: "user", content: userContent, type: "user" });

    const appState = createInitialAppState();

    // Build workflow context for system prompt so chat understands workflow state
    const workflowContext: string[] = [];
    if (sessionId) {
      try {
        const allTasks = await listTasks(cwd());
        const sessionTasks = allTasks.filter(t => t.sessionId === sessionId);
        if (sessionTasks.length > 0) {
          // Workflow overview
          const taskMap = new Map(sessionTasks.map(t => [t.id, t]));
          const running = sessionTasks.filter(t => t.status === 'in_progress');
          const failedPaused = sessionTasks.filter(t => t.status === 'paused' && t.lastError);
          const completed = sessionTasks.filter(t => t.status === 'done');
          const pending = sessionTasks.filter(t => t.status === 'todo');
          const checkpoints = sessionTasks.filter(t => t.status === 'paused' && !t.lastError && t.checkpointAfter);

          workflowContext.push(`## Workflow Context`);
          workflowContext.push(`The user is running a workflow with ${sessionTasks.length} tasks.`);
          workflowContext.push(`Progress: ${completed.length} done, ${running.length} running, ${pending.length} pending, ${failedPaused.length} failed, ${checkpoints.length} waiting for checkpoint.`);

          workflowContext.push(`\n### CRITICAL: Your Role`);
          workflowContext.push(`You are the chat assistant for a workflow session. The workflow tasks are executed by a separate executor system, but you CAN control it.`);
          workflowContext.push(`- Use the **TaskControl** tool to interact with the workflow: list tasks, retry/skip/continue/resume tasks, start/stop the executor, or set task status.`);
          workflowContext.push(`- When the user says "继续"/"continue": use TaskControl with action "continue" or "skip" on the failed task (use "list" first to find the taskId).`);
          workflowContext.push(`- When the user says "重试"/"retry": use TaskControl with action "retry" on the failed task.`);
          workflowContext.push(`- When the user says "跳过"/"skip": use TaskControl with action "skip" on the failed task.`);
          workflowContext.push(`- When the user wants to resume/start the workflow: use TaskControl with action "start-executor".`);
          workflowContext.push(`- You MAY also execute workflow steps yourself using other tools (Shell, GrpcClient, etc.) if the user asks you to do something directly. But for workflow STATUS changes (retry, skip, continue, resume), prefer TaskControl.`);
          workflowContext.push(`- If the user asks about the workflow state, use TaskControl "list" to get current status, then explain it.`);

          // Task list with dependencies and status
          workflowContext.push(`\n### Task Status:`);
          for (const t of sessionTasks) {
            let line = `- ${t.title} [${t.status}]`;
            if (t.assignee) line += ` (agent: ${t.assignee})`;
            if (t.dependsOn && t.dependsOn.length > 0) {
              const depTitles = t.dependsOn.map(id => taskMap.get(id)?.title || id.slice(0, 8)).join(', ');
              line += ` ← depends on: ${depTitles}`;
            }
            if (t.status === 'failed' && t.lastError) line += ` | ERROR: ${t.lastError.slice(0, 150)}`;
            if (t.status === 'paused' && t.lastError) line += ` | FAILED, waiting for user decision: ${t.lastError.slice(0, 150)}`;
            if (t.status === 'paused' && !t.lastError && t.checkpointAfter) line += ` | CHECKPOINT: ${t.checkpointMessage || 'waiting for user input'}`;
            if (t.requiresApproval && t.status === 'todo') line += ` | needs approval: ${t.approvalMessage || ''}`;
            workflowContext.push(line);
          }

          // Current focus
          if (running.length > 0) {
            workflowContext.push(`\n### Currently Executing: ${running.map(t => t.title).join(', ')}`);
          }

          // Guidance for user commands
          if (failedPaused.length > 0) {
            workflowContext.push(`\n### Action Needed`);
            workflowContext.push(`There ${failedPaused.length === 1 ? 'is a failed task' : 'are failed tasks'} waiting for user decision.`);
            workflowContext.push(`- If user says "继续"/"continue": they want to continue the workflow past the failure (skip the failed task).`);
            workflowContext.push(`- If user says "重试"/"retry": they want to retry the failed task.`);
            workflowContext.push(`- If user says "跳过"/"skip": they want to skip the failed task and move on.`);
            workflowContext.push(`- If user asks about the error: explain what went wrong based on the error info above.`);
          }
          if (checkpoints.length > 0) {
            workflowContext.push(`\n### Checkpoint Waiting`);
            workflowContext.push(`Task "${checkpoints[0]!.title}" is paused at a checkpoint: ${checkpoints[0]!.checkpointMessage || 'waiting for user input'}. The user may need to provide input or confirmation.`);
          }
          if (running.length === 0 && failedPaused.length === 0 && checkpoints.length === 0 && pending.length > 0) {
            workflowContext.push(`\nNo task is currently running. ${pending.length} task(s) are pending. The executor may need to be started.`);
          }
        }
      } catch {}
    }

    try {
      for await (const msg of query({
        prompt: messageText,
        messages: session.getMessages(),
        systemPrompt: workflowContext,
        sessionId: session.sessionId,
        toolUseContext: {
          cwd: cwd(),
          abortController,
          messages: session.getMessages(),
          getAppState: () => appState,
          setAppState: (updater) => { Object.assign(appState, updater(appState)); },
        },
        canUseTool,
        onAssistantTextDelta: (text) => {
          send("delta", { text });
        },
        onPermissionRequest: async (request) => {
          const permId = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          send("permission", { id: permId, ...request });

          // Wait for response from frontend
          return new Promise<boolean>((resolve) => {
            httpPermissions.set(permId, { resolve, request });

            // Timeout after 120s
            setTimeout(() => {
              if (httpPermissions.has(permId)) {
                httpPermissions.delete(permId);
                resolve(false);
                send("permission-timeout", { id: permId });
              }
            }, 120000);
          });
        },
      })) {
        await session.recordMessages([msg]).catch(() => {});

        // Send message event with full content (including tool_use blocks)
        if (msg.type === "user") {
          // Already sent above
        } else {
          // Build blocks array for frontend rendering
          const blocks: any[] = [];
          const textParts: string[] = [];
          if (Array.isArray(msg.content)) {
            for (const b of msg.content) {
              if (b.type === "text") {
                textParts.push(b.text || "");
                blocks.push({ type: "text", text: b.text || "" });
              } else if (b.type === "tool_use") {
                blocks.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
              }
            }
          }
          const textContent = typeof msg.content === "string" ? msg.content : textParts.join("");
          send("message", {
            id: msg.id,
            role: msg.type === "tool_result" ? (msg.isError ? "tool_error" : "tool_result") : "assistant",
            content: textContent,
            blocks: blocks.length > 0 ? blocks : undefined,
            toolUseId: msg.type === "tool_result" ? msg.toolUseId : undefined,
            type: msg.type,
          });
        }
      }

      send("done", { sessionId: session.sessionId });

      if (!input.keepOpen) {
        await closeSession(cwd(), session.sessionId).catch(() => {});
      }
    } catch (error) {
      send("error", { message: error instanceof Error ? error.message : String(error) });
    } finally {
      httpAbortControllers.delete(chatReqId);
      res.end();
    }
  })();
}

// Register SSE endpoint as a special route
routes.set("POST /api/chat/sse", async (req, body) => {
  // This is handled specially in the server — return a sentinel
  return { _sse: true, req, body };
});

// Live session events SSE — subscribe to real-time events from executor
function handleSessionEventsSse(req: http.IncomingMessage, res: http.ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send("connected", { status: "ok" });

  // Forward all relevant executor events
  const onSessionMessageAppended = (data: any) => send("session:message-appended", data);
  const onTaskClaimed = (data: any) => send("executor:task-claimed", data);
  const onTaskProgress = (data: any) => send("executor:task-progress", data);
  const onTaskCompleted = (data: any) => send("executor:task-completed", data);
  const onExecutorCycle = (data: any) => send("executor:cycle", data);
  const onToolStart = (data: any) => send("tool:start", data);
  const onToolResult = (data: any) => send("tool:result", data);
  const onToolError = (data: any) => send("tool:error", data);
  const onToolProgress = (data: any) => send("tool:progress", data);
  const onApprovalRequired = (data: any) => send("approval:required", data);
  const onApprovalResolved = (data: any) => send("approval:resolved", data);
  const onTaskPermission = (data: any) => send("permission", data);
  const onTaskPermissionTimeout = (data: any) => send("permission-timeout", data);

  eventBus.on("session:message-appended", onSessionMessageAppended);
  eventBus.on("executor:task-claimed", onTaskClaimed);
  eventBus.on("executor:task-progress", onTaskProgress);
  eventBus.on("executor:task-completed", onTaskCompleted);
  eventBus.on("executor:cycle", onExecutorCycle);
  eventBus.on("tool:start", onToolStart);
  eventBus.on("tool:result", onToolResult);
  eventBus.on("tool:error", onToolError);
  eventBus.on("tool:progress", onToolProgress);
  eventBus.on("approval:required", onApprovalRequired);
  eventBus.on("approval:resolved", onApprovalResolved);
  eventBus.on("task:permission-request", onTaskPermission);
  eventBus.on("task:permission-timeout", onTaskPermissionTimeout);

  req.on("close", () => {
    eventBus.off("session:message-appended", onSessionMessageAppended);
    eventBus.off("executor:task-claimed", onTaskClaimed);
    eventBus.off("executor:task-progress", onTaskProgress);
    eventBus.off("executor:task-completed", onTaskCompleted);
    eventBus.off("executor:cycle", onExecutorCycle);
    eventBus.off("tool:start", onToolStart);
    eventBus.off("tool:result", onToolResult);
    eventBus.off("tool:error", onToolError);
    eventBus.off("tool:progress", onToolProgress);
    eventBus.off("approval:required", onApprovalRequired);
    eventBus.off("approval:resolved", onApprovalResolved);
    eventBus.off("task:permission-request", onTaskPermission);
    eventBus.off("task:permission-timeout", onTaskPermissionTimeout);
  });
}

// Task execution via SSE
function handleTaskExecuteSse(req: http.IncomingMessage, res: http.ServerResponse, taskId: string) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  (async () => {
    const task = await readTaskInfo(cwd(), taskId);
    if (!task) {
      send("error", { message: "Task not found" });
      res.end();
      return;
    }

    await initLlmConfig();
    const { runAgent } = await import("../../tools/agent/runAgent");
    const { canUseTool } = await import("../../permissions/engine");

    // Ensure session exists
    let sessionId = task.sessionId;
    if (!sessionId) {
      sessionId = createId("session");
      await createSession(cwd(), sessionId, {
        taskId,
        title: `${task.assignee || "agent"}: ${task.title || taskId}`,
      });
      await updateTaskInfo(cwd(), taskId, { sessionId });
    }

    // Mark task as in_progress
    await updateTaskInfo(cwd(), taskId, { status: "in_progress" });
    send("status", { status: "in_progress" });

    const title = task.title || taskId;
    let prompt = `## Task: ${title}\n\n`;
    if (task.description) prompt += `${task.description}\n\n`;
    prompt += `## Instructions\n`;
    prompt += `- Focus ONLY on completing this specific task. Do NOT start other unrelated work.\n`;
    prompt += `- Do NOT modify files unless the task explicitly requires it.\n`;
    prompt += `- If the task is simple (e.g. say hello, acknowledge, confirm), just respond directly. Do NOT use tools unnecessarily.\n`;
    prompt += `- Do NOT launch sub-agents unless the task is genuinely complex and requires delegation.\n`;
    prompt += `- Keep your response concise and to the point.\n`;
    prompt += `- When done, clearly state what you accomplished.\n\n`;

    // Include structured gRPC config if available
    if (task.grpcConfig) {
      prompt += `## gRPC Task\n\n`;
      prompt += `You MUST use the **GrpcClient** tool to execute this gRPC call. Do NOT use Shell or any other tool.\n\n`;
      prompt += `Call the GrpcClient tool with these exact parameters:\n`;
      prompt += `- protoFile: "${task.grpcConfig.protoFile || 'protos/AlgoService.proto'}"\n`;
      prompt += `- service: "${task.grpcConfig.service}"\n`;
      prompt += `- method: "${task.grpcConfig.method}"\n`;
      prompt += `- address: "${task.grpcConfig.address}"\n`;
      prompt += `- payload: ${JSON.stringify(task.grpcConfig.payload, null, 2)}\n`;
      if (task.grpcConfig.metadata) prompt += `- metadata: ${JSON.stringify(task.grpcConfig.metadata)}\n`;
      if (task.grpcConfig.deadline) prompt += `- deadline: ${task.grpcConfig.deadline}\n`;
      prompt += `\nAfter the GrpcClient call completes, report the response. If it fails, use the Checkpoint tool to ask the user.\n`;
    }

    prompt += `Work in the current directory.`;

    const appState = createInitialAppState();
    const abortController = new AbortController();
    const allMessages: Message[] = [];

    try {
      const result = await runAgent({
        description: title,
        prompt,
        subagentType: task.assignee || "general-purpose",
        parentContext: {
          cwd: cwd(),
          abortController,
          messages: [],
          getAppState: () => appState,
          setAppState: (updater) => { Object.assign(appState, updater(appState)); },
        },
        canUseTool,
        maxTurns: 8,
        onProgress: (text) => send("progress", { text }),
        onMessage: async (msg) => {
          allMessages.push(msg);
          send("message", { id: msg.id, type: msg.type, content: msg.content });
          // Write to transcript
          try {
            const { appendTranscript } = await import("../../storage/transcript");
            await appendTranscript(cwd(), sessionId!, [msg]);
          } catch {}
        },
      });

      // Auto-verify if no acceptance criteria
      // Update session info
      try {
        const { readTranscriptMessages } = await import("../../storage/transcript");
        const allMessages = await readTranscriptMessages(cwd(), sessionId);
        await updateSessionInfo(cwd(), sessionId, allMessages);
      } catch {}

      // Always go to verify first (state machine requires in_progress → verify)
      await updateTaskInfo(cwd(), taskId, { status: "verify" });

      // Auto-approve if no acceptance criteria
      const updatedTask = await readTaskInfo(cwd(), taskId);
      const hasCriteria = updatedTask?.acceptanceCriteria && updatedTask.acceptanceCriteria.length > 0;
      if (!hasCriteria) {
        await updateTaskInfo(cwd(), taskId, { status: "done" });
        send("status", { status: "done" });
      } else {
        send("status", { status: "verify" });
      }
      send("done", { result });
    } catch (error) {
      await updateTaskInfo(cwd(), taskId, { status: "failed", lastError: error instanceof Error ? error.message : String(error) });
      send("status", { status: "failed" });
      send("error", { message: error instanceof Error ? error.message : String(error) });
    } finally {
      res.end();
    }
  })();
}

// ====== Task Auto-Execution Poll ======

const executingTasks = new Set<string>();
const taskAbortControllers = new Map<string, AbortController>();
const pendingApprovalTasks = new Map<string, ApprovalRequestEvent>(); // tasks waiting for user approval
const approvalEmittedAt = new Map<string, number>(); // taskId → last emit timestamp (throttle re-emits)
const APPROVAL_REEMIT_INTERVAL_MS = 30000; // re-emit at most every 30s, not every 5s poll
const taskPermissions = new Map<string, { resolve: (approved: boolean) => void; request: any }>(); // task tool permissions
let taskPollInterval: ReturnType<typeof setInterval> | null = null;

// Approval request type (mirrors eventBus type)
type ApprovalRequestEvent = {
  taskId: string
  taskTitle: string
  approvalMessage?: string
  stepIndex: number
  stepTotal: number
  requestType?: 'task_failure' | 'checkpoint'
  errorMessage?: string
}

function isTaskBlocked(task: any, allTasks: any[]): boolean {
  if (!task.dependsOn || task.dependsOn.length === 0) return false;
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  
  let anyDepComplete = false;
  let hasBlockingDep = false;

  for (const depId of task.dependsOn) {
    const dep = taskMap.get(depId);
    if (!dep) continue; // missing dep = not blocked (graceful)
    
    // Check if dep is complete
    if (dep.status === "done" || dep.status === "failed" || dep.skipped) {
      anyDepComplete = true;
    }
    
    // Check if dep is blocking
    if (dep.status === "paused" || 
        !(dep.status === "done" || dep.status === "failed" || dep.skipped)) {
      hasBlockingDep = true;
    }
  }

  if (hasBlockingDep) return true;
  if (!anyDepComplete) return true;
  return false;
}

async function pollAndExecuteTasks() {
  try {
    // Re-emit pending checkpoint approvals (for "later" action or SSE reconnect)
    // Skip task_failure requests — those are shown as inline action bar, not popup
    // Throttle: re-emit at most every 30s per task, not every 5s poll cycle
    for (const [taskId, req] of pendingApprovalTasks.entries()) {
      if (req.requestType === 'task_failure') continue;
      const task = await readTaskInfo(cwd(), taskId);
      if (task?.status === "paused") {
        const lastEmitted = approvalEmittedAt.get(taskId) || 0;
        if (Date.now() - lastEmitted < APPROVAL_REEMIT_INTERVAL_MS) continue;
        approvalEmittedAt.set(taskId, Date.now());
        log("INFO", "AutoExec", `Re-emitting checkpoint approval for: ${task.title}`);
        eventBus.emit("approval:required", req);
      }
    }

    // Use the updated getUnblockedTasks function that already handles conditions and checkpoints
    const unblockedTasks = await getUnblockedTasks(cwd());

    // Mark tasks as skipped if their condition is not met (deps satisfied but condition fails)
    const allTasksForCondition = await listTasks(cwd());
    for (const t of allTasksForCondition) {
      if (t.status !== "todo" || t.skipped || !t.condition) continue;
      // Only process tasks with a valid sessionId (skip orphaned tasks from old sessions)
      if (!t.sessionId) continue;
      // Check if all deps are done
      if (!t.dependsOn || t.dependsOn.length === 0) continue;
      const allDepsDone = t.dependsOn.every(depId => {
        const dep = allTasksForCondition.find(tt => tt.id === depId);
        return dep && (dep.status === "done" || dep.status === "failed" || dep.skipped);
      });
      if (!allDepsDone) continue;
      // Verify condition.source exists in task list (skip if source not found = stale data)
      if (t.condition.source && !allTasksForCondition.find(tt => tt.id === t.condition!.source)) continue;
      // Deps done but condition not met → skip. Use evaluateCondition directly
      // (single source of truth, consistent with assignDependentTasks).
      if (!evaluateCondition(t.condition, allTasksForCondition)) {
        log("INFO", "AutoExec", `Skipping task ${t.title}: condition not met`);
        await updateTaskInfo(cwd(), t.id, { skipped: true }, "executor");
      }
    }

    // Filter out tasks that are already executing
    const availableTasks = unblockedTasks.filter(t => !executingTasks.has(t.id));

    if (availableTasks.length === 0) return;

    // Separate requiresApproval tasks from auto-executable tasks
    const approvalTasks = availableTasks.filter(t => t.requiresApproval && !pendingApprovalTasks.has(t.id));
    const autoTasks = availableTasks.filter(t => !t.requiresApproval);

    // Store approval requests for tasks that need user confirmation
    const allTasks = await listTasks(cwd());
    for (const task of approvalTasks) {
      const proposalTasks = allTasks.filter(t => t.dependsOn || allTasks.some(tt => tt.dependsOn?.includes(t.id)));
      const stepIndex = proposalTasks.findIndex(t => t.id === task.id) + 1;
      const stepTotal = proposalTasks.length;

      const approvalReq: ApprovalRequestEvent = {
        taskId: task.id,
        taskTitle: task.title || task.id,
        approvalMessage: task.approvalMessage,
        stepIndex: stepTotal > 0 ? stepIndex : 0,
        stepTotal: stepTotal > 0 ? stepTotal : 1,
      };
      pendingApprovalTasks.set(task.id, approvalReq);

      log("INFO", "AutoExec", `Requesting approval for: ${task.title} (step ${stepIndex}/${stepTotal})`);
      eventBus.emit("approval:required", approvalReq);
      approvalEmittedAt.set(task.id, Date.now());
    }

    // Auto-execute non-approval tasks — start all independent tasks in parallel,
    // bounded by a concurrency cap. Previously only autoTasks[0] was executed per
    // poll cycle, forcing independent tasks to wait 5s each.
    if (autoTasks.length === 0) return;

    const MAX_CONCURRENT = 3;
    const slotsAvailable = MAX_CONCURRENT - executingTasks.size;
    const toStart = autoTasks.slice(0, Math.max(0, slotsAvailable));

    for (const task of toStart) {
      executingTasks.add(task.id);
      log("INFO", "AutoExec", `Auto-executing unblocked task: ${task.title} (${task.id})`);
      // Fire-and-forget: don't await — let independent tasks run concurrently.
      // executeTaskViaHttp handles its own errors and status transitions.
      executeTaskViaHttp(task.id)
        .catch(e => log("ERROR", "AutoExec", `Auto-execution failed for ${task.id}`, e))
        .finally(() => executingTasks.delete(task.id));
    }
  } catch (e) {
    log("ERROR", "AutoExec", "Poll error", e);
  }
}

/** Assign downstream tasks whose dependencies are now satisfied */
async function assignDependentTasks(completedTaskId: string) {
  const tasks = await listTasks(cwd());
  const completed = tasks.find(t => t.id === completedTaskId);
  if (!completed) return;

  // Find tasks that depend on the completed task
  const dependents = tasks.filter(t =>
    t.dependsOn?.includes(completedTaskId) &&
    t.status === "todo" &&
    !executingTasks.has(t.id) &&
    !t.skipped
  );

  for (const dep of dependents) {
    // Check if ANY dependency is complete and NO dependencies are blocking
    let anyDepComplete = false;
    let hasBlockingDep = false;

    for (const depId of dep.dependsOn!) {
      const d = tasks.find(t => t.id === depId);
      if (!d) continue;
      
      if (d.status === "done" || d.status === "failed" || d.skipped) {
        anyDepComplete = true;
      }
      
      if (d.status === "paused" || 
          !(d.status === "done" || d.status === "failed" || d.skipped)) {
        hasBlockingDep = true;
      }
    }

    if (hasBlockingDep || !anyDepComplete) continue;

    // Check condition if exists
    if (dep.condition) {
      const conditionMet = evaluateCondition(dep.condition, tasks);
      if (!conditionMet) {
        log("INFO", "AutoExec", `Condition not met, skipping task: ${dep.title}`);
        await updateTaskInfo(cwd(), dep.id, { skipped: true }, "auto-exec");
        // Continue to its dependents
        await assignDependentTasks(dep.id);
        continue;
      }
    }

    // Assign the task (set assignee) but keep in todo for the poll to pick up
    const assignee = dep.assignee || "general-purpose";
    if (!dep.assignee) {
      await updateTaskInfo(cwd(), dep.id, { assignee }, "auto-exec");
    }

    if (dep.requiresApproval) {
      // Emit approval request immediately instead of waiting for poll cycle
      if (!pendingApprovalTasks.has(dep.id)) {
        const approvalReq: ApprovalRequestEvent = {
          taskId: dep.id,
          taskTitle: dep.title || dep.id,
          approvalMessage: dep.approvalMessage,
          stepIndex: 0,
          stepTotal: 1,
        };
        pendingApprovalTasks.set(dep.id, approvalReq);
        log("INFO", "AutoExec", `Dependency met, requesting approval for: ${dep.title}`);
        eventBus.emit("approval:required", approvalReq);
      }
    } else {
      // Auto-execute non-approval tasks
      log("INFO", "AutoExec", `Dependency met, executing downstream task ${dep.id}: ${dep.title}`);
      await updateTaskInfo(cwd(), dep.id, { status: "in_progress" }, "auto-exec");
      executingTasks.add(dep.id);
      executeTaskViaHttp(dep.id).finally(() => {
        executingTasks.delete(dep.id);
      });
    }
  }
}

/**
 * Shared single-shot LLM call. Handles both Anthropic and OpenAI-compatible
 * providers. Returns the assistant text (or null) and whether the call
 * succeeded, so callers can apply their own fallback logic.
 */
async function callLlm(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<{ ok: boolean; text: string | null; status: number }> {
  const config = getLlmConfig();
  if (!config?.apiKey) {
    return { ok: false, text: null, status: 0 };
  }
  const isAnthropic = config.provider === 'anthropic' || (config.baseUrl && config.baseUrl.includes('anthropic'));
  const baseUrl = config.baseUrl || (isAnthropic ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1');

  if (isAnthropic) {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': config.anthropicVersion || '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      log("ERROR", "LLM", `Anthropic API ${response.status}: ${errBody.slice(0, 300)}`);
      return { ok: false, text: null, status: response.status };
    }
    const data = await response.json();
    return { ok: true, text: data.content?.[0]?.text || null, status: response.status };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    log("ERROR", "LLM", `OpenAI API ${response.status}: ${errBody.slice(0, 300)}`);
    return { ok: false, text: null, status: response.status };
  }
  const data = await response.json();
  const msg = data.choices?.[0]?.message || {};
  const text = msg.content || msg.reasoning_content || msg.text || null;
  return { ok: true, text, status: response.status };
}

async function generateErrorSummary(taskTitle: string, taskDescription: string | undefined, errorMessage: string, sessionMessages: any[]): Promise<string> {
  try {
    const recentMessages = sessionMessages.slice(-10).map((m: any) => {
      if (typeof m.content === 'string') return `${m.type}: ${m.content.slice(0, 500)}`;
      if (Array.isArray(m.content)) {
        const texts = m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text);
        const tools = m.content.filter((c: any) => c.type === 'tool_use').map((c: any) => `${c.name}(${JSON.stringify(c.input).slice(0, 200)})`);
        const results = m.content.filter((c: any) => c.type === 'tool_result').map((c: any) => {
          const content = typeof c.content === 'string' ? c.content : JSON.stringify(c.content);
          return `${c.is_error ? '[ERROR] ' : ''}${content.slice(0, 400)}`;
        });
        return `${m.type}: ${[...texts, ...tools, ...results].join(' | ')}`;
      }
      return '';
    }).join('\n');

    const systemPrompt = `You are a technical error analyst. Explain WHY the task failed in a clear, conversational way — like a senior engineer briefing a colleague.

Your summary MUST include:
1. **Which tool/action failed** — name the specific tool (e.g. GrpcClient, Shell, Read) that produced the error
2. **What kind of error** — classify it: connection refused, timeout, wrong parameters, permission denied, file not found, API returned error, etc.
3. **The root cause** in one sentence

Format: "<ToolName> 调用失败：<error type>。<root cause>"
Example: "GrpcClient 调用失败：连接被拒绝 (ECONNREFUSED)。目标地址 192.168.25.106:9010 无法连接，可能服务未启动或网络不通。"

Reply in the same language as the task. Keep it under 2 sentences. No markdown.`;
    const userMessage = `Task: ${taskTitle}
Description: ${taskDescription || 'N/A'}
Error: ${errorMessage}

Recent conversation:
${recentMessages}

Summarize the failure reason concisely:`;

    const result = await callLlm(systemPrompt, userMessage, 256);
    if (!result.ok || !result.text) return errorMessage.slice(0, 200);
    return result.text;
  } catch (e) {
    log("ERROR", "ErrorSummary", `Failed to generate summary: ${e}`);
    return errorMessage.slice(0, 200);
  }
}

type PmEnhancement = {
  enrichedDescriptions: Record<string, string>;
  warnings: string[];
  suggestions: string[];
};

async function enhanceTemplateWithPm(
  templateName: string,
  templateDescription: string | undefined,
  nodes: Array<{ id: string; name: string; description?: string; agent?: string; grpc?: any }>,
  userMessage: string,
): Promise<PmEnhancement | null> {
  try {
    const config = getLlmConfig();
    if (!config?.apiKey) {
      log("WARN", "PMEnhance", "No LLM config/apiKey, skipping PM enhancement");
      return null;
    }
    log("INFO", "PMEnhance", `Enhancing template "${templateName}" with ${nodes.length} nodes, provider=${config.provider}, model=${config.model}`);

    const nodesText = nodes.map((n, i) =>
      `Node ${i + 1}: ${n.name} (id=${n.id}, agent=${n.agent || 'general-purpose'})\n  desc: ${n.description || 'N/A'}\n  grpc: ${n.grpc ? `${n.grpc.service}.${n.grpc.method}` : 'N/A'}`
    ).join('\n');

    const systemPrompt = `You are a PM agent. Analyze the workflow template and enrich it.

CRITICAL: Output ONLY a JSON object. Do NOT include any thinking process, reasoning, or explanation text. Do NOT use markdown code fences. Start your response with { and end with }.

JSON Schema:
{"enrichedDescriptions": {"<nodeId>": "<improved description with context>"}, "warnings": ["<risk or issue>"], "suggestions": ["<improvement suggestion>"]}

Reply in the same language as the user message.`;

    const userContent = `User intent: ${userMessage}
Template: ${templateName}
Description: ${templateDescription || 'N/A'}

Nodes:
${nodesText}

Enrich each node description, identify risks, suggest improvements. Output JSON:`;

    const llmResult = await callLlm(systemPrompt, userContent, 1024);
    if (!llmResult.ok) return null;
    const responseText = llmResult.text;

    if (!responseText) {
      log("WARN", "PMEnhance", "Empty response text from LLM (content field null/empty), using fallback");
      return { enrichedDescriptions: {}, warnings: ["LLM 返回空响应，使用原始描述"], suggestions: [] };
    }
    // Strip markdown code fences
    let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Some reasoning models (e.g. qwen3) put thinking process before the JSON.
    // Try multiple extraction strategies.
    let parsed: any;
    const tryParse = (text: string): any | null => {
      try { return JSON.parse(text); } catch { return null; }
    };

    // Strategy 1: direct parse
    parsed = tryParse(cleaned);
    if (parsed) {
      log("INFO", "PMEnhance", "Parsed JSON directly");
    }

    // Strategy 2: find JSON object containing enrichedDescriptions
    if (!parsed) {
      const match = cleaned.match(/\{[\s\S]*?"enrichedDescriptions"[\s\S]*?\}/);
      if (match) {
        parsed = tryParse(match[0]);
        if (parsed) log("INFO", "PMEnhance", "Extracted JSON via enrichedDescriptions regex");
      }
    }

    // Strategy 3: first { to last }
    if (!parsed) {
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        parsed = tryParse(cleaned.slice(jsonStart, jsonEnd + 1));
        if (parsed) log("INFO", "PMEnhance", `Extracted JSON via first/last brace (offset ${jsonStart}-${jsonEnd})`);
      }
    }

    if (!parsed) {
      log("WARN", "PMEnhance", `JSON extraction failed, using original descriptions. Raw: ${cleaned.slice(0, 200)}`);
      return { enrichedDescriptions: {}, warnings: [], suggestions: [] };
    }
    const result = {
      enrichedDescriptions: parsed.enrichedDescriptions || {},
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
    log("INFO", "PMEnhance", `Success: ${Object.keys(result.enrichedDescriptions).length} enriched, ${result.warnings.length} warnings, ${result.suggestions.length} suggestions`);
    return result;
  } catch (e) {
    log("WARN", "PMEnhance", `Enhancement skipped: ${e}`);
    return { enrichedDescriptions: {}, warnings: [], suggestions: [] };
  }
}

/**
 * Fire-and-forget: trigger reflection after a task failure so the agent
 * can extract anti-patterns / constraints / remediation hints.
 * Only fires when there are tool errors in the transcript.
 */
function triggerReflectionOnFailure(
  taskId: string,
  sessionId: string | undefined,
  title: string,
  messages: Message[],
): void {
  if (!sessionId || messages.length === 0) return;
  const errorMessages = messages.filter(m => m.type === "tool_result" && (m as any).isError);
  if (errorMessages.length === 0) return;

  const errorCount = errorMessages.length;
  const lastError = errorMessages
    .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    .join('; ').slice(0, 200) || "Unknown error";

  const sessionInfo = {
    id: sessionId,
    title,
    messageCount: messages.length,
    toolUseCount: messages.filter(m => m.type === "tool_result").length,
    errorCount,
    lastError,
    status: "error" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const emptyState = createInitialAppState();
  const parentContext: ToolUseContext = {
    cwd: cwd(),
    abortController: new AbortController(),
    messages: [],
    getAppState: () => emptyState,
    setAppState: () => {},
    agentId: "reflection",
    agentType: "reflect",
  };

  evolveAfterSession(cwd(), sessionInfo, messages, parentContext, {
    ...DEFAULT_EVOLUTION_CONFIG,
    reflectionOnComplete: false,
    reflectionOnError: true,
  }).catch(e => {
    log("ERROR", "Reflection", `Reflection failed for task ${taskId}: ${e}`);
  });
  log("INFO", "Reflection", `Reflection scheduled for failed task ${taskId} (${errorCount} errors)`);
}

/**
 * Execute a gRPC task directly via GrpcClientTool.call(), bypassing the LLM.
 * Writes assistant + tool_result messages to the transcript so the existing
 * post-execution logic (error detection, reflection, status transitions)
 * works unchanged.
 */
async function executeGrpcDirectly(
  taskId: string,
  task: { grpcConfig?: any; sessionId?: string },
  sessionId: string,
  abortController: AbortController,
  appState: ReturnType<typeof createInitialAppState>,
): Promise<void> {
  const { GrpcClientTool } = await import("../../tools/grpc/grpcClientTool");
  const { appendTranscript } = await import("../../storage/transcript");

  const grpc = task.grpcConfig;
  if (!grpc) return;

  const toolUseId = createId("tooluse");
  const input: GrpcClientInput = {
    protoFile: grpc.protoFile || "protos/AlgoService.proto",
    service: grpc.service,
    method: grpc.method,
    address: grpc.address,
    payload: grpc.payload || {},
    metadata: grpc.metadata,
    deadline: grpc.deadline,
  };

  // Write assistant message with tool_use block
  const assistantMsg: AssistantMessage = {
    id: createId("msg"),
    type: "assistant",
    content: [{
      type: "tool_use",
      id: toolUseId,
      name: "GrpcClient",
      input,
    }],
  };
  await appendTranscript(cwd(), sessionId, [assistantMsg]);
  eventBus.emit("session:message-appended", { sessionId, message: assistantMsg });

  const context: ToolUseContext = {
    cwd: cwd(),
    abortController,
    messages: [],
    getAppState: () => appState,
    setAppState: () => {},
    agentId: "grpc-direct",
    agentType: "grpc-worker",
  };

  let resultContent: string;
  let isError = false;
  try {
    log("INFO", "AutoExec", `Direct gRPC call: ${grpc.service}.${grpc.method} → ${grpc.address}`);
    const result = await GrpcClientTool.call(
      input,
      context,
      async () => ({ behavior: "allow" as const }),
      assistantMsg,
    );
    resultContent = JSON.stringify(result.data, null, 2);
    log("INFO", "AutoExec", `Direct gRPC call succeeded (${result.data.durationMs}ms)`);
  } catch (error) {
    isError = true;
    resultContent = error instanceof Error ? error.message : String(error);
    log("ERROR", "AutoExec", `Direct gRPC call failed: ${resultContent.slice(0, 200)}`);
  }

  // Write tool_result message
  const toolResultMsg: ToolResultMessage = {
    id: createId("msg"),
    type: "tool_result",
    toolUseId,
    content: resultContent,
    isError,
  };
  await appendTranscript(cwd(), sessionId, [toolResultMsg]);
  eventBus.emit("session:message-appended", { sessionId, message: toolResultMsg });
}

async function executeTaskViaHttp(taskId: string) {
  const task = await readTaskInfo(cwd(), taskId);
  if (!task) {
    log("ERROR", "AutoExec", `Task ${taskId} not found`);
    return;
  }

  log("INFO", "AutoExec", `Starting execution: "${task.title}" (${taskId}), assignee=${task.assignee}`);

  await initLlmConfig();
  const { runAgent } = await import("../../tools/agent/runAgent");
  const { canUseTool } = await import("../../permissions/engine");
  const { appendTranscript } = await import("../../storage/transcript");

  // Ensure session exists
  let sessionId = task.sessionId;
  if (!sessionId) {
    sessionId = createId("session");
    await createSession(cwd(), sessionId, {
      taskId,
      title: `${task.assignee || "agent"}: ${task.title || taskId}`,
    });
    await updateTaskInfo(cwd(), taskId, { sessionId });
    log("INFO", "AutoExec", `Created session ${sessionId} for task ${taskId}`);
  }

  // Mark in_progress
  if (task.status !== "in_progress") {
    await updateTaskInfo(cwd(), taskId, { status: "in_progress" });
  }

  eventBus.emit("executor:task-claimed", { taskId, title: task.title || taskId });

  const title = task.title || taskId;
  let prompt = `## Task: ${title}\n\n`;
  if (task.description) prompt += `${task.description}\n\n`;

  // Include context from dependency tasks (especially failures when user chose 'continue')
  if (task.dependsOn && task.dependsOn.length > 0) {
    const depContext: string[] = [];
    for (const depId of task.dependsOn) {
      const depTask = await readTaskInfo(cwd(), depId);
      if (!depTask) continue;
      const depStatus = depTask.status;
      if (depStatus === 'done') {
        depContext.push(`- "${depTask.title}": completed successfully`);
      } else if (depStatus === 'failed') {
        depContext.push(`- "${depTask.title}": FAILED${depTask.lastError ? ` — ${depTask.lastError.slice(0, 200)}` : ''}. User chose to continue despite this failure. Be aware of this when executing.`);
      } else if (depTask.skipped) {
        depContext.push(`- "${depTask.title}": skipped`);
      }
    }
    if (depContext.length > 0) {
      prompt += `## Previous Steps Context\n`;
      prompt += depContext.join('\n') + '\n\n';
    }
  }

  prompt += `## Instructions\n`;
  prompt += `- Focus ONLY on completing this specific task. Do NOT start other unrelated work.\n`;
  prompt += `- Do NOT modify files unless the task explicitly requires it.\n`;
  prompt += `- If the task is simple (e.g. say hello, acknowledge, confirm), just respond directly. Do NOT use tools unnecessarily.\n`;
  prompt += `- Do NOT launch sub-agents unless the task is genuinely complex and requires delegation.\n`;
  prompt += `- Keep your response concise and to the point.\n`;
  prompt += `- When done, clearly state what you accomplished.\n\n`;

  // Include structured gRPC config if available
  if (task.grpcConfig) {
    prompt += `## gRPC Task\n\n`;
    prompt += `You MUST use the **GrpcClient** tool to execute this gRPC call. Do NOT use Shell or any other tool.\n\n`;
    prompt += `Call the GrpcClient tool with these exact parameters:\n`;
    prompt += `- protoFile: "${task.grpcConfig.protoFile || 'protos/AlgoService.proto'}"\n`;
    prompt += `- service: "${task.grpcConfig.service}"\n`;
    prompt += `- method: "${task.grpcConfig.method}"\n`;
    prompt += `- address: "${task.grpcConfig.address}"\n`;
    prompt += `- payload: ${JSON.stringify(task.grpcConfig.payload, null, 2)}\n`;
    if (task.grpcConfig.metadata) prompt += `- metadata: ${JSON.stringify(task.grpcConfig.metadata)}\n`;
    if (task.grpcConfig.deadline) prompt += `- deadline: ${task.grpcConfig.deadline}\n`;
    prompt += `\nAfter the GrpcClient call completes, report the response. If it fails, use the Checkpoint tool to ask the user.\n`;
  }

  prompt += `Work in the current directory.`;

  const appState = createInitialAppState();
  const abortController = new AbortController();
  taskAbortControllers.set(taskId, abortController);
  let messageCount = 0;

  try {
    let result: string | undefined;
    if (task.grpcConfig) {
      log("INFO", "AutoExec", `Task ${taskId} executing gRPC directly (bypassing LLM)`);
      await executeGrpcDirectly(taskId, task, sessionId!, abortController, appState);
      result = "(direct gRPC execution)";
    } else {
      log("INFO", "AutoExec", `Calling runAgent for task ${taskId}, subagentType=${task.assignee || "general-purpose"}`);
      result = await runAgent({
      description: title,
      prompt,
      subagentType: task.assignee || "general-purpose",
      parentContext: {
        cwd: cwd(),
        abortController,
        messages: [],
        getAppState: () => appState,
        setAppState: (updater) => { Object.assign(appState, updater(appState)); },
      },
      canUseTool,
      maxTurns: 8,
      onPermissionRequest: async (request) => {
        // Checkpoint tool needs special handling: inject checkpointId and auto-respond
        // so the workflow's own failure/checkpoint mechanism takes over instead.
        if (request.toolName === "Checkpoint") {
          const input = request.input as any;
          const checkpointId = `ckpt-${taskId}-${Date.now()}`;
          // Auto-respond based on checkpoint type
          let response: any;
          if (input?.type === "error_choice") {
            // Workflow has its own retry/skip/stop UI — auto-skip to let task fail and trigger that flow
            response = { choice: input?.options?.[0] || "skip" };
          } else if (input?.type === "approval") {
            response = { approved: true };
          } else {
            response = { data: {} };
          }
          const { setCheckpointResponse } = await import("../../tools/workflow/checkpointTool");
          setCheckpointResponse(checkpointId, response);
          // Return updated input with checkpointId injected
          return {
            allowed: true,
            updatedInput: { ...input, __checkpointId: checkpointId },
          } as any;
        }
        log("INFO", "AutoExec", `Task ${taskId} auto-approving tool ${request.toolName} (workflow mode)`);
        return true;
      },
      onProgress: (text) => {
        eventBus.emit("executor:task-progress", { taskId, text });
      },
      onMessage: async (msg) => {
        messageCount++;
        log("INFO", "AutoExec", `Message #${messageCount} for task ${taskId}: type=${msg.type}`);
        try {
          await appendTranscript(cwd(), sessionId!, [msg]);
          eventBus.emit("session:message-appended", { sessionId, message: msg });
        } catch (e) {
          log("ERROR", "AutoExec", `Failed to write message to transcript: ${e}`);
        }
      },
    });

    } // end of else (LLM path)

    log("INFO", "AutoExec", `Execution returned for task ${taskId}: ${messageCount} messages, mode=${task.grpcConfig ? "direct" : "llm"}`);

    // Update session info
    let allMessagesForCheck: any[] = [];
    try {
      const { readTranscriptMessages } = await import("../../storage/transcript");
      allMessagesForCheck = await readTranscriptMessages(cwd(), sessionId);
      await updateSessionInfo(cwd(), sessionId, allMessagesForCheck);
    } catch (e) {
      log("ERROR", "AutoExec", `Failed to update session info: ${e}`);
    }

    // Check for tool-level errors (e.g., gRPC failures).
    // Only consider the LAST tool_result: if the agent retried and recovered,
    // an earlier error must not cause a false failure.
    const toolResultMessages = allMessagesForCheck.filter((m: any) => m.type === 'tool_result');
    const lastToolResult = toolResultMessages[toolResultMessages.length - 1];
    const hasToolErrors = !!lastToolResult && !!lastToolResult.isError;
    if (hasToolErrors) {
      log("INFO", "AutoExec", `Task ${taskId} has tool errors, marking as failed`);
      const failedTask = await readTaskInfo(cwd(), taskId);
      // Extract actual error text from the failing tool_result
      const toolErrorMessages = [lastToolResult]
        .filter((m: any) => m && m.isError)
        .map((m: any) => {
          if (typeof m.content === 'string') return m.content;
          if (Array.isArray(m.content)) return m.content.map((c: any) => c.text || JSON.stringify(c)).join(' ');
          return JSON.stringify(m.content);
        });
      const actualError = toolErrorMessages.join('; ').slice(0, 500) || "Tool execution failed";
      log("INFO", "AutoExec", `Task ${taskId} tool error detail: ${actualError.slice(0, 200)}`);
      const errorSummary = await generateErrorSummary(
        failedTask?.title || taskId,
        failedTask?.description,
        actualError,
        allMessagesForCheck
      );
      // Tool errors: pause and ask user what to do (same as catch-block failure path)
      log("INFO", "AutoExec", `Task ${taskId} has tool errors, pausing for user decision`);
      await updateTaskInfo(cwd(), taskId, { status: "paused", lastError: errorSummary });
      const failureReq = {
        taskId,
        taskTitle: failedTask?.title || taskId,
        approvalMessage: `Task failed: ${errorSummary.slice(0, 200)}`,
        stepIndex: 0,
        stepTotal: 1,
        requestType: 'task_failure' as const,
        errorMessage: errorSummary,
      };
      pendingApprovalTasks.set(taskId, failureReq);
      eventBus.emit("approval:required", failureReq);
      triggerReflectionOnFailure(taskId, sessionId, failedTask?.title || taskId, allMessagesForCheck);
      return;
    }

    // Always go to verify first (state machine requires in_progress → verify)
    await updateTaskInfo(cwd(), taskId, { status: "verify" });

    // Auto-approve if no acceptance criteria
    const updatedTask = await readTaskInfo(cwd(), taskId);
    const hasCriteria = updatedTask?.acceptanceCriteria && updatedTask.acceptanceCriteria.length > 0;
    if (!hasCriteria) {
      // Check if this task has checkpoint_after — pause for user confirmation before marking done
      if (updatedTask?.checkpointAfter) {
        log("INFO", "AutoExec", `Task ${taskId} has checkpoint_after, pausing for user confirmation`);
        await updateTaskInfo(cwd(), taskId, { status: "paused" });
        const checkpointReq: ApprovalRequestEvent = {
          taskId,
          taskTitle: updatedTask.title || taskId,
          approvalMessage: updatedTask.checkpointMessage || `Task "${updatedTask.title}" completed. Confirm to continue?`,
          stepIndex: 0,
          stepTotal: 1,
        };
        pendingApprovalTasks.set(taskId, checkpointReq);
        eventBus.emit("approval:required", checkpointReq);
        // assignDependentTasks will be called when user approves via the approval endpoint
      } else {
        await updateTaskInfo(cwd(), taskId, { status: "done" });
        log("INFO", "AutoExec", `Task ${taskId} auto-approved → done (${messageCount} messages)`);
        // Assign downstream tasks whose dependencies are now met
        await assignDependentTasks(taskId);
      }
    } else {
      log("INFO", "AutoExec", `Task ${taskId} → verify, waiting for manual review (${messageCount} messages)`);
    }

    eventBus.emit("executor:task-completed", { taskId, success: true });
  } catch (error) {
    if (abortController.signal.aborted) {
      // Abort was triggered by pause/cancel/stop route — it already set the target status.
      // Don't overwrite it with 'failed'. Just log and emit.
      const currentTask = await readTaskInfo(cwd(), taskId);
      log("INFO", "AutoExec", `Task ${taskId} was aborted, current status: ${currentTask?.status}`);
      eventBus.emit("executor:task-completed", { taskId, success: false, result: "Aborted" });
      return;
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    log("ERROR", "AutoExec", `Task ${taskId} failed: ${errMsg}`);
    const failedTask = await readTaskInfo(cwd(), taskId);
    let sessionMessages: any[] = [];
    try {
      if (failedTask?.sessionId) {
        sessionMessages = await readTranscriptMessages(cwd(), failedTask.sessionId);
      }
    } catch {}
    const errorSummary = await generateErrorSummary(
      failedTask?.title || taskId,
      failedTask?.description,
      errMsg,
      sessionMessages
    );
    await updateTaskInfo(cwd(), taskId, { status: "paused", lastError: errorSummary });

    // Emit failure approval request — ask user what to do
    const task = await readTaskInfo(cwd(), taskId);
    const failureReq = {
      taskId,
      taskTitle: task?.title || taskId,
      approvalMessage: `Task failed: ${errMsg.slice(0, 200)}`,
      stepIndex: 0,
      stepTotal: 1,
      requestType: 'task_failure' as const,
      errorMessage: errorSummary,
    };
    pendingApprovalTasks.set(taskId, failureReq);
    eventBus.emit("approval:required", failureReq);
    triggerReflectionOnFailure(taskId, failedTask?.sessionId, failedTask?.title || taskId, sessionMessages);
    // Don't emit task-completed yet — wait for user decision
    // Task stays 'paused' so downstream tasks are blocked (getUnblockedTasks
    // treats paused deps as blocking). User decision will set failed/todo.
  } finally {
    taskAbortControllers.delete(taskId);
  }
}

export function startTaskAutoExec(pollIntervalMs = 5000) {
  if (taskPollInterval) return;
  log("INFO", "AutoExec", `Starting task auto-execution poll (every ${pollIntervalMs}ms)`);
  taskPollInterval = setInterval(pollAndExecuteTasks, pollIntervalMs);
  // Run once immediately
  pollAndExecuteTasks();
}

export function stopTaskAutoExec() {
  if (taskPollInterval) {
    clearInterval(taskPollInterval);
    taskPollInterval = null;
  }
}

// Permission response endpoint
routes.set("POST /api/chat/permission-response", async (_req, body) => {
  const input = JSON.parse(body);
  // Check chat permissions first
  const pending = httpPermissions.get(input.id);
  if (pending) {
    httpPermissions.delete(input.id);
    pending.resolve(input.approved === true);
    return { ok: true };
  }
  // Check task permissions
  const taskPending = taskPermissions.get(input.id);
  if (taskPending) {
    taskPermissions.delete(input.id);
    taskPending.resolve(input.approved === true);
    return { ok: true };
  }
  return { error: "No pending permission request with that ID" };
});

// Cancel endpoint
routes.set("POST /api/chat/cancel", async () => {
  // Abort all in-flight chat queries (supports concurrent requests)
  for (const [id, controller] of httpAbortControllers) {
    controller.abort();
    httpAbortControllers.delete(id);
  }
  // Reject all pending permissions
  for (const [id, pending] of httpPermissions) {
    pending.resolve(false);
    httpPermissions.delete(id);
  }
  return { ok: true };
});

// ====== Health ======

// Poll for pending approval requests
routes.set("GET /api/approvals/pending", async () => {
  return { approvals: Array.from(pendingApprovalTasks.values()) };
});

routes.set("GET /api/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// ====== Route matching ======

function matchRoute(method: string, url: string): { handler: RouteHandler; params: Record<string, string> } | null {
  // Try exact match first
  const exactKey = `${method} ${url}`;
  if (routes.has(exactKey)) return { handler: routes.get(exactKey)!, params: {} };

  // Try pattern match (e.g., /api/tasks/:id)
  for (const [pattern, handler] of routes) {
    const [pMethod, pPath] = pattern.split(" ");
    if (pMethod !== method) continue;

    const patternParts = pPath.split("/");
    const urlParts = url.split("/");
    if (patternParts.length !== urlParts.length) continue;

    const params: Record<string, string> = {};
    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i]!.startsWith(":")) {
        params[patternParts[i]!.slice(1)] = urlParts[i]!;
      } else if (patternParts[i] !== urlParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler, params };
  }

  return null;
}

// ====== Server ======

// ====== Static file serving ======

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

function getStaticDir(): string {
  // In dev: gui/out, in production: out/
  return join(cwd(), "gui", "out");
}

async function serveStaticFile(url: string, res: http.ServerResponse): Promise<boolean> {
  const staticDir = getStaticDir();
  let filePath = join(staticDir, url === "/" ? "index.html" : url);

  // Security: prevent directory traversal
  if (!filePath.startsWith(staticDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  try {
    const fileStat = await stat(filePath);

    // If it's a directory, try index.html
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
    }

    const content = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
    });
    res.end(content);
    return true;
  } catch {
    // File not found — try serving index.html for SPA routing
    try {
      const indexPath = join(staticDir, "index.html");
      const content = await readFile(indexPath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(content);
      return true;
    } catch {
      return false;
    }
  }
}

export function startHttpServer(port = 3002): http.Server {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");

    // Handle preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url?.split("?")[0] || "/";
    const method = req.method || "GET";

    // API routes
    if (url.startsWith("/api/")) {
      // SSE chat endpoint — handled specially
      if (method === "POST" && url === "/api/chat/sse") {
        const body = await readBody(req);
        handleChatSse(req, res, body);
        return;
      }

      // SSE task execution endpoint
      const taskExecuteMatch = url.match(/^\/api\/tasks\/([^/]+)\/execute$/)
      if (method === "POST" && taskExecuteMatch) {
        handleTaskExecuteSse(req, res, taskExecuteMatch[1]!);
        return;
      }

      // SSE live session events endpoint
      if (method === "GET" && url === "/api/events") {
        handleSessionEventsSse(req, res);
        return;
      }

      try {
        const match = matchRoute(method, url);
        if (!match) {
          json(res, { error: `Not found: ${method} ${url}` }, 404);
          return;
        }

        const body = await readBody(req);
        const result = await match.handler(req, body, match.params);

        if (result && typeof result === "object" && "error" in result && (result as any).error === "Not found") {
          json(res, result, 404);
          return;
        }

        json(res, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("ERROR", "HTTP", `${method} ${url} failed: ${message}`);
        json(res, { error: message }, 500);
      }
      return;
    }

    // Static file serving for non-API routes
    if (method === "GET") {
      const served = await serveStaticFile(url, res);
      if (served) return;
    }

    json(res, { error: "Not found" }, 404);
  });

  server.listen(port, "0.0.0.0", () => {
    log("INFO", "HTTP", `HTTP server listening on http://0.0.0.0:${port}`);
    log("INFO", "HTTP", `API: http://0.0.0.0:${port}/api/health`);
    log("INFO", "HTTP", `CORS enabled for all origins`);

    // Start auto-execution poll for unblocked tasks
    startTaskAutoExec(5000);
  });

  // Listen for executor control commands from chat/tools
  const onExecutorCommand = async (cmd: any) => {
    try {
      log("INFO", "AutoExec", `executor:command received: ${cmd.action} ${cmd.taskId || ''}`);
      if (cmd.action === 'start') {
        startTaskAutoExec();
      } else if (cmd.action === 'stop') {
        stopTaskAutoExec();
        for (const [taskId, controller] of taskAbortControllers) {
          controller.abort();
          await updateTaskInfo(cwd(), taskId, { status: "paused" }).catch(() => {});
        }
        taskAbortControllers.clear();
        executingTasks.clear();
      } else if (cmd.action === 'resume-task' && cmd.taskId) {
        const task = await readTaskInfo(cwd(), cmd.taskId);
        if (task && task.status === 'paused') {
          await updateTaskInfo(cwd(), cmd.taskId, { status: "in_progress" });
          executingTasks.add(cmd.taskId);
          executeTaskViaHttp(cmd.taskId).finally(() => { executingTasks.delete(cmd.taskId); });
        }
      } else if (cmd.action === 'retry-task' && cmd.taskId) {
        await updateTaskInfo(cwd(), cmd.taskId, { status: "todo", lastError: null }).catch(() => {});
        pendingApprovalTasks.delete(cmd.taskId);
        approvalEmittedAt.delete(cmd.taskId);
        eventBus.emit("approval:resolved", { taskId: cmd.taskId, action: "execute" });
        startTaskAutoExec();
      } else if (cmd.action === 'skip-task' && cmd.taskId) {
        await updateTaskInfo(cwd(), cmd.taskId, { status: "failed", lastError: cmd.reason || "Skipped by user via chat" }).catch(() => {});
        pendingApprovalTasks.delete(cmd.taskId);
        approvalEmittedAt.delete(cmd.taskId);
        eventBus.emit("approval:resolved", { taskId: cmd.taskId, action: "execute" });
        await assignDependentTasks(cmd.taskId).catch(() => {});
        eventBus.emit("executor:task-completed", { taskId: cmd.taskId, success: false, result: "Skipped" });
      } else if (cmd.action === 'continue-task' && cmd.taskId) {
        await updateTaskInfo(cwd(), cmd.taskId, { status: "failed" }).catch(() => {});
        pendingApprovalTasks.delete(cmd.taskId);
        approvalEmittedAt.delete(cmd.taskId);
        eventBus.emit("approval:resolved", { taskId: cmd.taskId, action: "execute" });
        await assignDependentTasks(cmd.taskId).catch(() => {});
        eventBus.emit("executor:task-completed", { taskId: cmd.taskId, success: false, result: "Continued past failure" });
      } else if (cmd.action === 'set-status' && cmd.taskId && cmd.status) {
        const updates: any = { status: cmd.status };
        if (cmd.status === 'todo' || cmd.status === 'in_progress') {
          updates.lastError = null;
        } else if (cmd.reason) {
          updates.lastError = cmd.reason;
        }
        await updateTaskInfo(cwd(), cmd.taskId, updates).catch(() => {});
        if (cmd.status === 'done') {
          await assignDependentTasks(cmd.taskId).catch(() => {});
          eventBus.emit("executor:task-completed", { taskId: cmd.taskId, success: true });
        }
      }
    } catch (e) {
      log("ERROR", "AutoExec", `executor:command failed: ${e}`);
    }
  };
  eventBus.on("executor:command", onExecutorCommand);

  return server;
}

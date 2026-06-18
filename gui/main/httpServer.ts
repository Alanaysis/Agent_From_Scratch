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

type RouteHandler = (req: http.IncomingMessage, body: string) => Promise<unknown>;

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
  await deleteSessionInfo(cwd(), params!.id!);
  await deleteTranscript(cwd(), params!.id!).catch(() => {});
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
  const task = await updateTaskInfo(cwd(), params!.id!, { assignee: undefined }, "user");
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
  const action = input.action as string;

  if (!action || !['execute', 'later', 'abort', 'continue', 'retry', 'stop'].includes(action)) {
    return { error: "action must be 'execute', 'later', 'abort', 'continue', 'retry', or 'stop'" };
  }

  const pendingReq = pendingApprovalTasks.get(taskId);
  
  // Don't delete for later action - we want to re-prompt
  if (action !== 'later') {
    pendingApprovalTasks.delete(taskId);
  }

  // Handle task failure decisions
  if (pendingReq?.requestType === 'task_failure') {
    eventBus.emit("approval:resolved", { taskId, action });

    if (action === 'retry') {
      // Retry: reset task to todo and re-execute
      log("INFO", "AutoExec", `Retrying failed task ${taskId}`);
      await updateTaskInfo(cwd(), taskId, { status: "todo", lastError: undefined });
      executingTasks.add(taskId);
      executeTaskViaHttp(taskId).finally(() => {
        executingTasks.delete(taskId);
      });
      return { ok: true, action: "retry" };
    }

    if (action === 'continue' || action === 'execute') {
      // Continue: keep as failed, but trigger downstream tasks
      log("INFO", "AutoExec", `Continuing after failed task ${taskId}`);
      await assignDependentTasks(taskId);
      eventBus.emit("executor:task-completed", { taskId, success: false, result: pendingReq.errorMessage });
      return { ok: true, action: action };
    }

    // stop/abort: keep as failed, don't continue (user will intervene manually)
    log("INFO", "AutoExec", `Stopped after failed task ${taskId}`);
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
    // Do not delete from pendingApprovalTasks or set checkpointAwaiting to false!
    // We keep it so that the next poll will re-trigger the approval prompt
    pendingApprovalTasks.set(taskId, pendingReq!);
    return { ok: true, action: "later" };
  }

  // action === 'execute'
  eventBus.emit("approval:resolved", { taskId, action });

  // Check if this is a checkpoint_after confirmation (task already completed)
  const task = await readTaskInfo(cwd(), taskId);
  if (task?.status === 'done' && task?.checkpointAfter) {
    // This is a checkpoint confirmation — trigger downstream tasks
    log("INFO", "AutoExec", `Checkpoint confirmed for task ${taskId}, triggering downstream tasks`);
    await updateTaskInfo(cwd(), taskId, { checkpointAwaiting: false });
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
  const agents = await listAgentsByCapability(cwd());
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
    const safePath = validateFilePath(input.filePath, cwd());
    yaml = await readFileFs(safePath, "utf8");
  }
  if (!yaml) return { error: "No filePath provided" };

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

    const task = await createTask(cwd(), {
      id: taskId,
      title: step.name,
      description: description.trim() || undefined,
      priority: "medium",
      status: "todo",
      assignee: step.agent || "general-purpose",
      dependsOn,
      createdBy: input.createdBy || "compact",
    });

    await updateTaskInfo(cwd(), taskId, { sessionId });

    createdTasks.push({
      id: taskId,
      title: step.name,
      assignee: task.assignee,
      status: task.status,
      dependsOn,
    });
  }

  return { sessionId, workflow: workflow.name, tasks: createdTasks };
});

// ====== Recipes ======

import { readRecipe, createRecipe, updateRecipe, deleteRecipe, listRecipes, findRecipesByTrigger } from "../../storage/recipeIndex";

routes.set("GET /api/recipes", async () => {
  return { recipes: await listRecipes(cwd()) };
});

routes.set("GET /api/recipes/:id", async (_req, _body, params?: Record<string, string>) => {
  const recipe = await readRecipe(cwd(), params!.id!);
  return { recipe };
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

routes.set("POST /api/recipes", async (_req, body) => {
  const input = JSON.parse(body);
  const recipe = await createRecipe(cwd(), { id: createId("recipe"), name: input.name, description: input.description, triggers: input.triggers || [], tasks: input.tasks || [] });
  return { recipe };
});

routes.set("PATCH /api/recipes/:id", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const recipe = await updateRecipe(cwd(), params!.id!, input);
  return { recipe };
});

routes.set("DELETE /api/recipes/:id", async (_req, _body, params?: Record<string, string>) => {
  await deleteRecipe(cwd(), params!.id!);
  return { ok: true };
});

routes.set("POST /api/recipes/find", async (_req, body) => {
  const input = JSON.parse(body);
  const recipes = await findRecipesByTrigger(cwd(), input.trigger);
  return { recipes };
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
  const plan = await createPlan(cwd(), { id: createId("plan"), title: input.title, description: input.description, tasks: input.tasks || [], recipeId: input.recipeId, createdBy: input.createdBy });
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

// ====== Executor ======

routes.set("POST /api/executor/start", async () => {
  return { ok: true, message: "Executor start via HTTP not yet implemented" };
});

routes.set("POST /api/executor/stop", async () => {
  return { ok: true, message: "Executor stop via HTTP not yet implemented" };
});

// ====== PM ======

routes.set("POST /api/pm/create-plan", async (_req, body) => {
  const input = JSON.parse(body);
  const { findRecipesByTrigger } = await import("../../storage/recipeIndex");

  const goal = input.goal || "Untitled goal";
  const keywords = goal.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/).filter((w: string) => w.length > 1);

  // Search recipes by keywords
  const matchedRecipes = new Map<string, any>();
  for (const keyword of keywords) {
    const recipes = await findRecipesByTrigger(cwd(), keyword);
    for (const recipe of recipes) {
      matchedRecipes.set(recipe.id, recipe);
    }
  }

  let taskDrafts: any[] = [];
  let title = `Plan: ${goal}`;
  let description = `Proposal for goal: ${goal}`;

  if (matchedRecipes.size > 0) {
    const sortedRecipes = [...matchedRecipes.values()].sort((a, b) => {
      const aMatches = a.triggers.filter((t: string) => keywords.some((k: string) => t.toLowerCase().includes(k))).length;
      const bMatches = b.triggers.filter((t: string) => keywords.some((k: string) => t.toLowerCase().includes(k))).length;
      return bMatches - aMatches;
    });
    const recipe = sortedRecipes[0];
    title = `Plan: ${goal}`;
    description = `Auto-generated proposal from recipe "${recipe.name}" for goal: ${goal}`;

    const tempIdMap = new Map<number, string>();
    taskDrafts = recipe.tasks.map((template: any, index: number) => {
      const tempId = `draft-${index}`;
      tempIdMap.set(index, tempId);
      return {
        tempId,
        title: template.title,
        description: template.description,
        agent: template.agent,
        priority: template.priority,
        dependsOnTempIds: template.dependsOnIndex?.map((depIndex: number) => tempIdMap.get(depIndex)).filter(Boolean),
      };
    });
  } else {
    taskDrafts = [{
      tempId: "draft-0",
      title: goal,
      description: `Complete the following goal: ${goal}`,
      priority: "medium",
    }];
  }

  const proposal = await createProposal(cwd(), {
    id: createId("proposal"),
    title,
    description,
    inputType: "manual",
    status: "draft",
    taskDrafts,
    documentDrafts: [],
    createdBy: input.createdBy,
  });

  return { proposal };
});

// ====== Config (read-only, API key masked) ======

import { loadConfig, saveConfig, mergeEnvIntoConfig, getDefaultConfig } from "../../runtime/config";

routes.set("GET /api/config", async () => {
  try {
    const config = await loadConfig(cwd());
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
  const config = await saveConfig(cwd(), allowed);
  return { llm: { ...config.llm, apiKey: config.llm.apiKey ? "[SET]" : "" }, source: "file" };
});

// ====== Chat (SSE streaming + permission support) ======

import { SessionEngine } from "../../runtime/session";
import { query } from "../../runtime/query";
import { canUseTool } from "../../permissions/engine";
import { createInitialAppState } from "../../runtime/state";
import { readTranscriptMessages } from "../../storage/transcript";
import { initLlmConfig } from "../../runtime/llm";
import type { Message } from "../../runtime/messages";
import { eventBus } from "../../shared/eventBus";

// Pending permission requests for HTTP mode
const httpPermissions = new Map<string, { resolve: (approved: boolean) => void; request: unknown }>();
let httpAbortController: AbortController | null = null;

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

  // Clean up listeners when connection closes
  res.on("close", () => {
    eventBus.off("tool:start", onToolStart);
    eventBus.off("tool:result", onToolResult);
    eventBus.off("tool:error", onToolError);
    eventBus.off("tool:progress", onToolProgress);
    eventBus.off("session:message-appended", onSessionMessageAppended);
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
    const abortController = new AbortController();
    httpAbortController = abortController;

    try {
      for await (const msg of query({
        prompt: messageText,
        messages: session.getMessages(),
        systemPrompt: [],
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
      httpAbortController = null;
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

  eventBus.on("session:message-appended", onSessionMessageAppended);
  eventBus.on("executor:task-claimed", onTaskClaimed);
  eventBus.on("executor:task-progress", onTaskProgress);
  eventBus.on("executor:task-completed", onTaskCompleted);
  eventBus.on("executor:cycle", onExecutorCycle);
  eventBus.on("tool:start", onToolStart);
  eventBus.on("tool:result", onToolResult);
  eventBus.on("tool:error", onToolError);
  eventBus.on("tool:progress", onToolProgress);

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
const pendingApprovalTasks = new Map<string, ApprovalRequestEvent>(); // tasks waiting for user approval
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
    if (dep.checkpointAwaiting || 
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
    // Re-emit pending checkpoint approvals (for "later" action)
    for (const [taskId, req] of pendingApprovalTasks.entries()) {
      const task = await readTaskInfo(cwd(), taskId);
      if (task?.checkpointAwaiting) {
        log("INFO", "AutoExec", `Re-emitting checkpoint approval for: ${task.title}`);
        eventBus.emit("approval:required", req);
      }
    }

    // Use the updated getUnblockedTasks function that already handles conditions and checkpoints
    const unblockedTasks = await getUnblockedTasks(cwd());
    
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
    }

    // Auto-execute non-approval tasks
    if (autoTasks.length === 0) return;

    const task = autoTasks[0]!;
    executingTasks.add(task.id);
    log("INFO", "AutoExec", `Auto-executing unblocked task: ${task.title} (${task.id})`);

    try {
      await executeTaskViaHttp(task.id);
    } catch (e) {
      log("ERROR", "AutoExec", `Auto-execution failed for ${task.id}`, e);
    } finally {
      executingTasks.delete(task.id);
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
      
      if (d.checkpointAwaiting || 
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
  let messageCount = 0;

  try {
    log("INFO", "AutoExec", `Calling runAgent for task ${taskId}, subagentType=${task.assignee || "general-purpose"}`);

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

    log("INFO", "AutoExec", `runAgent returned for task ${taskId}: ${messageCount} messages, result length=${result?.length || 0}`);

    // Update session info
    let allMessagesForCheck: any[] = [];
    try {
      const { readTranscriptMessages } = await import("../../storage/transcript");
      allMessagesForCheck = await readTranscriptMessages(cwd(), sessionId);
      await updateSessionInfo(cwd(), sessionId, allMessagesForCheck);
    } catch (e) {
      log("ERROR", "AutoExec", `Failed to update session info: ${e}`);
    }

    // Check for tool-level errors (e.g., gRPC failures)
    const hasToolErrors = allMessagesForCheck.some((m: any) => m.type === 'tool_result' && m.isError);
    if (hasToolErrors) {
      log("INFO", "AutoExec", `Task ${taskId} has tool errors, marking as failed`);
      await updateTaskInfo(cwd(), taskId, { status: "failed", lastError: "Tool execution failed" });
      eventBus.emit("executor:task-completed", { taskId, success: false, result: "Tool execution failed" });
      return;
    }

    // Always go to verify first (state machine requires in_progress → verify)
    await updateTaskInfo(cwd(), taskId, { status: "verify" });

    // Auto-approve if no acceptance criteria
    const updatedTask = await readTaskInfo(cwd(), taskId);
    const hasCriteria = updatedTask?.acceptanceCriteria && updatedTask.acceptanceCriteria.length > 0;
    if (!hasCriteria) {
      await updateTaskInfo(cwd(), taskId, { status: "done" });
      log("INFO", "AutoExec", `Task ${taskId} auto-approved → done (${messageCount} messages)`);

      // Check if this task has checkpoint_after — wait for user confirmation before continuing
      if (updatedTask?.checkpointAfter) {
        log("INFO", "AutoExec", `Task ${taskId} has checkpoint_after, waiting for user confirmation`);
        await updateTaskInfo(cwd(), taskId, { checkpointAwaiting: true });
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
        // Assign downstream tasks whose dependencies are now met
        await assignDependentTasks(taskId);
      }
    } else {
      log("INFO", "AutoExec", `Task ${taskId} → verify, waiting for manual review (${messageCount} messages)`);
    }

    eventBus.emit("executor:task-completed", { taskId, success: true });
  } catch (error) {
    if (abortController.signal.aborted) {
      log("INFO", "AutoExec", `Task ${taskId} was aborted`);
      await updateTaskInfo(cwd(), taskId, { status: "failed", lastError: "Aborted by user" });
      eventBus.emit("executor:task-completed", { taskId, success: false, result: "Aborted" });
      return;
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    log("ERROR", "AutoExec", `Task ${taskId} failed: ${errMsg}`);
    await updateTaskInfo(cwd(), taskId, { status: "failed", lastError: errMsg });

    // Emit failure approval request — ask user what to do
    const task = await readTaskInfo(cwd(), taskId);
    const failureReq = {
      taskId,
      taskTitle: task?.title || taskId,
      approvalMessage: `Task failed: ${errMsg.slice(0, 200)}`,
      stepIndex: 0,
      stepTotal: 1,
      requestType: 'task_failure' as const,
      errorMessage: errMsg,
    };
    pendingApprovalTasks.set(taskId, failureReq);
    eventBus.emit("approval:required", failureReq);
    // Don't emit task-completed yet — wait for user decision
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
  const pending = httpPermissions.get(input.id);
  if (pending) {
    httpPermissions.delete(input.id);
    pending.resolve(input.approved === true);
    return { ok: true };
  }
  return { error: "No pending permission request with that ID" };
});

// Cancel endpoint
routes.set("POST /api/chat/cancel", async () => {
  if (httpAbortController) {
    httpAbortController.abort();
    httpAbortController = null;
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

  return server;
}

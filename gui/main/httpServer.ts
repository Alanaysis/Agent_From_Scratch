import http from "http";
import { cwd } from "process";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { log } from "./logger";

// Import the same storage functions used by IPC handlers
import { listSessions, readSessionInfo, createSession, deleteSessionInfo, touchSession, closeSession, updateSessionInfo } from "../../storage/sessionIndex";
import { readTranscriptMessages, deleteTranscript, getTranscriptPath } from "../../storage/transcript";
import { listTasks, readTaskInfo, createTask, updateTaskInfo, deleteTaskInfo, getUnblockedTasks, addTaskComment } from "../../storage/taskIndex";
import { listProposals, readProposal, createProposal, updateProposal, deleteProposal, approveProposal } from "../../storage/proposalIndex";
import { listDocuments, readDocument, createDocument, updateDocument, deleteDocument } from "../../storage/documentIndex";
import { listWorkflows, readWorkflow, deleteWorkflow, saveWorkflow, parseWorkflowYaml, importWorkflowAsProposal } from "../../storage/workflowIndex";
import { listAgents, readAgentInfo, createAgent, updateAgentInfo, deleteAgentInfo } from "../../storage/agentIndex";
import { createId } from "../../shared/ids";
import { eventBus } from "../../shared/eventBus";

type RouteHandler = (req: http.IncomingMessage, body: string) => Promise<unknown>;

const routes = new Map<string, RouteHandler>();

// ====== Helper ======

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
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
  const task = await updateTaskInfo(cwd(), params!.id!, { assignee: input.assignee, status: "in_progress" }, input.actor);
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

// Resolve approval: execute now, later, or abort
routes.set("POST /api/tasks/:id/approve", async (_req, body, params?: Record<string, string>) => {
  const input = JSON.parse(body);
  const taskId = params!.id!;
  const action = input.action as 'execute' | 'later' | 'abort';

  pendingApprovalTasks.delete(taskId);

  if (action === 'abort') {
    await updateTaskInfo(cwd(), taskId, { status: "failed", lastError: "Aborted by user" }, "user");
    eventBus.emit("approval:resolved", { taskId, action });
    return { ok: true, action: "abort" };
  }

  if (action === 'later') {
    eventBus.emit("approval:resolved", { taskId, action });
    return { ok: true, action: "later" };
  }

  // action === 'execute' — trigger execution
  eventBus.emit("approval:resolved", { taskId, action });
  // Execute in background
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
  const newDraft = { tempId: createId("draft"), ...input };
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
  const newDraft = { tempId: createId("doc"), ...input };
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
  const yaml = await readFileFs(input.filePath, "utf8");
  const workflow = parseWorkflowYaml(yaml);
  workflow.sourceFile = input.filePath;
  const { proposal } = await importWorkflowAsProposal(cwd(), workflow, input.createdBy);
  return { workflow, proposalId: proposal.id };
});

routes.set("POST /api/workflows/import", async (_req, body) => {
  const input = JSON.parse(body);
  const workflow = parseWorkflowYaml(input.yaml);
  const { proposal } = await importWorkflowAsProposal(cwd(), workflow, input.createdBy);
  return { workflow, proposalId: proposal.id };
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
  const agent = await updateAgentInfo(cwd(), params!.id!, input);
  return { agent };
});

routes.set("DELETE /api/agents/:id", async (_req, _body, params?: Record<string, string>) => {
  await deleteAgentInfo(cwd(), params!.id!);
  return { ok: true };
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
  const content = await readFileFs(input.filePath, "utf8");
  const workflow = parseWorkflowYaml(content);
  workflow.sourceFile = input.filePath;
  const { proposal } = await importWorkflowAsProposal(cwd(), workflow, input.createdBy);
  return { workflow, proposalId: proposal.id };
});

// Import workflow AND immediately create tasks (skip proposal draft)
routes.set("POST /api/workflows/import-and-execute", async (_req, body) => {
  const input = JSON.parse(body);
  const { readFile: readFileFs } = await import("fs/promises");
  let yaml = input.yaml;
  if (input.filePath) {
    yaml = await readFileFs(input.filePath, "utf8");
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

// ====== Recipes ======

import { readRecipe, createRecipe, updateRecipe, deleteRecipe, listRecipes, findRecipesByTrigger } from "../../storage/recipeIndex";

routes.set("GET /api/recipes", async () => {
  return { recipes: await listRecipes(cwd()) };
});

routes.set("GET /api/recipes/:id", async (_req, _body, params?: Record<string, string>) => {
  const recipe = await readRecipe(cwd(), params!.id!);
  return { recipe };
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
  return { error: "PM create-plan via HTTP not yet implemented" };
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

// Pending permission requests for HTTP mode
const httpPermissions = new Map<string, { resolve: (approved: boolean) => void; request: unknown }>();
let httpAbortController: AbortController | null = null;

// SSE chat endpoint
function handleChatSse(req: http.IncomingMessage, res: http.ServerResponse, body: string) {
  const input = JSON.parse(body);
  const message = input.message as string;
  const sessionId = input.sessionId as string | undefined;

  if (!message) {
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

  (async () => {
    await initLlmConfig();

    let session: SessionEngine;
    if (sessionId) {
      session = new SessionEngine({ id: sessionId, cwd: cwd() });
      session.hydrateMessages(await readTranscriptMessages(cwd(), sessionId).catch(() => []));
    } else {
      session = new SessionEngine({ id: createId("session"), cwd: cwd() });
    }

    const userMsg: Message = { id: createId("user"), type: "user", content: message };
    await session.recordMessages([userMsg]);
    send("message", { id: userMsg.id, role: "user", content: message, type: "user" });

    const appState = createInitialAppState();
    const abortController = new AbortController();
    httpAbortController = abortController;

    try {
      for await (const msg of query({
        prompt: message,
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
          const permId = `perm-${Date.now()}`;
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

        // Send message event
        if (msg.type === "user") {
          // Already sent above
        } else {
          const content = typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
              : "";
          send("message", { id: msg.id, role: "assistant", content, type: msg.type });
        }
      }

      send("done", { sessionId: session.sessionId });
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
    let prompt = `Task: ${title}\n\n`;
    if (task.description) prompt += `Description: ${task.description}\n\n`;
    prompt += `Please complete this task. Work in the current directory.`;

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
        maxTurns: 16,
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
}

function isTaskBlocked(task: any, allTasks: any[]): boolean {
  if (!task.dependsOn || task.dependsOn.length === 0) return false;
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  for (const depId of task.dependsOn) {
    const dep = taskMap.get(depId);
    if (!dep) continue; // missing dep = not blocked (graceful)
    if (dep.status !== "done" && dep.status !== "failed") return true;
  }
  return false;
}

async function pollAndExecuteTasks() {
  try {
    const tasks = await listTasks(cwd());
    const unblockedTasks = tasks.filter(t =>
      t.status === "todo" &&
      t.assignee &&
      !executingTasks.has(t.id) &&
      !isTaskBlocked(t, tasks)
    );

    if (unblockedTasks.length === 0) return;

    // Separate requiresApproval tasks from auto-executable tasks
    const approvalTasks = unblockedTasks.filter(t => t.requiresApproval && !pendingApprovalTasks.has(t.id));
    const autoTasks = unblockedTasks.filter(t => !t.requiresApproval);

    // Store approval requests for tasks that need user confirmation
    for (const task of approvalTasks) {
      const proposalTasks = tasks.filter(t => t.dependsOn || tasks.some(tt => tt.dependsOn?.includes(t.id)));
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
  let prompt = `Task: ${title}\n\n`;
  if (task.description) prompt += `Description: ${task.description}\n\n`;
  prompt += `Please complete this task. Work in the current directory.`;

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
      maxTurns: 16,
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
    try {
      const { readTranscriptMessages } = await import("../../storage/transcript");
      const allMessages = await readTranscriptMessages(cwd(), sessionId);
      await updateSessionInfo(cwd(), sessionId, allMessages);
    } catch (e) {
      log("ERROR", "AutoExec", `Failed to update session info: ${e}`);
    }

    // Always go to verify first (state machine requires in_progress → verify)
    await updateTaskInfo(cwd(), taskId, { status: "verify" });

    // Auto-approve if no acceptance criteria
    const updatedTask = await readTaskInfo(cwd(), taskId);
    const hasCriteria = updatedTask?.acceptanceCriteria && updatedTask.acceptanceCriteria.length > 0;
    if (!hasCriteria) {
      await updateTaskInfo(cwd(), taskId, { status: "done" });
      log("INFO", "AutoExec", `Task ${taskId} auto-approved → done (${messageCount} messages)`);
    } else {
      log("INFO", "AutoExec", `Task ${taskId} → verify, waiting for manual review (${messageCount} messages)`);
    }

    eventBus.emit("executor:task-completed", { taskId, success: true });
  } catch (error) {
    if (abortController.signal.aborted) {
      log("INFO", "AutoExec", `Task ${taskId} was aborted`);
      return;
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    log("ERROR", "AutoExec", `Task ${taskId} failed: ${errMsg}`);
    await updateTaskInfo(cwd(), taskId, { status: "failed", lastError: errMsg });
    eventBus.emit("executor:task-completed", { taskId, success: false, result: errMsg });
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
    pending.resolve(input.approved !== false);
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

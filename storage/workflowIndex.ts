import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import * as yaml from "js-yaml";
import { createProposal, type TaskDraft, type Proposal } from "./proposalIndex";
import { createId } from "../shared/ids";

export type GrpcCallConfig = {
  protoFile?: string;
  service: string;
  method: string;
  address?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, string>;
  deadline?: number;
};

export type OnErrorConfig = {
  action: "pause" | "retry" | "skip" | "abort";
  maxRetries?: number;
  message?: string;
};

export type InputFieldSchema = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  options?: string[];
  required?: boolean;
  default?: unknown;
};

export type WorkflowStep = {
  id: string;
  name: string;
  description?: string;
  agent?: string;
  dependsOn?: string[];
  grpc?: GrpcCallConfig;
  shell?: string;
  requiresApproval?: boolean;
  approvalMessage?: string;
  collectInput?: InputFieldSchema[];
  onError?: OnErrorConfig;
  acceptanceCriteria?: string[];
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  sourceFile?: string;
};

function getWorkflowsDir(cwd: string): string {
  return join(cwd, ".irg", "workflows");
}

function getWorkflowPath(cwd: string, workflowId: string): string {
  return join(getWorkflowsDir(cwd), `${workflowId}.json`);
}

export async function readWorkflow(
  cwd: string,
  workflowId: string,
): Promise<WorkflowDefinition | null> {
  try {
    const content = await readFile(getWorkflowPath(cwd, workflowId), "utf8");
    return JSON.parse(content) as WorkflowDefinition;
  } catch {
    return null;
  }
}

export async function saveWorkflow(
  cwd: string,
  workflow: WorkflowDefinition,
): Promise<WorkflowDefinition> {
  const now = new Date().toISOString();
  const saved: WorkflowDefinition = { ...workflow, updatedAt: now };

  await mkdir(getWorkflowsDir(cwd), { recursive: true });
  await writeFile(
    getWorkflowPath(cwd, workflow.id),
    `${JSON.stringify(saved, null, 2)}\n`,
    "utf8",
  );
  return saved;
}

export async function deleteWorkflow(cwd: string, workflowId: string): Promise<void> {
  await rm(getWorkflowPath(cwd, workflowId), { force: true });
}

export async function listWorkflows(cwd: string): Promise<WorkflowDefinition[]> {
  const workflows: WorkflowDefinition[] = [];
  try {
    const entries = await readdir(getWorkflowsDir(cwd));
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const workflowId = entry.replace(/\.json$/, "");
      const workflow = await readWorkflow(cwd, workflowId);
      if (workflow) workflows.push(workflow);
    }
  } catch {
    // ignore missing directory
  }
  return workflows.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

/** Parse a YAML workflow definition string. */
export function parseWorkflowYaml(yamlContent: string): WorkflowDefinition {
  const parsed = yaml.load(yamlContent) as any;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid YAML: expected an object");
  }
  if (!parsed.name || typeof parsed.name !== "string") {
    throw new Error("Workflow must have a 'name' field");
  }
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error("Workflow must have a non-empty 'steps' array");
  }

  const steps: WorkflowStep[] = parsed.steps.map((step: any, index: number) => {
    if (!step.id) throw new Error(`Step ${index} must have an 'id' field`);
    if (!step.name) throw new Error(`Step ${index} (${step.id}) must have a 'name' field`);

    return {
      id: step.id,
      name: step.name,
      description: step.description,
      agent: step.agent,
      dependsOn: step.depends_on || step.dependsOn,
      grpc: step.grpc ? {
        protoFile: step.grpc.protoFile || step.grpc.proto_file,
        service: step.grpc.service,
        method: step.grpc.method,
        address: step.grpc.address,
        payload: step.grpc.payload || {},
        metadata: step.grpc.metadata,
        deadline: step.grpc.deadline,
      } : undefined,
      shell: step.shell,
      requiresApproval: step.requires_approval || step.requiresApproval,
      approvalMessage: step.approval_message || step.approvalMessage,
      collectInput: step.collect_input || step.collectInput,
      onError: step.on_error || step.onError ? {
        action: (step.on_error || step.onError).action || "pause",
        maxRetries: (step.on_error || step.onError).max_retries || (step.on_error || step.onError).maxRetries,
        message: (step.on_error || step.onError).message,
      } : undefined,
      acceptanceCriteria: step.acceptance_criteria || step.acceptanceCriteria,
    };
  });

  return {
    id: createId("workflow"),
    name: parsed.name,
    description: parsed.description,
    steps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Build a gRPC call instruction for a task description. */
function buildGrpcInstruction(grpc: GrpcCallConfig): string {
  const parts = [`gRPC Call: ${grpc.service}.${grpc.method}`];
  if (grpc.address) parts.push(`Address: ${grpc.address}`);
  if (grpc.protoFile) parts.push(`Proto: ${grpc.protoFile}`);
  parts.push(`Payload: ${JSON.stringify(grpc.payload)}`);
  if (grpc.metadata) parts.push(`Metadata: ${JSON.stringify(grpc.metadata)}`);
  if (grpc.deadline) parts.push(`Deadline: ${grpc.deadline}ms`);
  return parts.join("\n");
}

/** Convert a workflow definition into a Proposal with task drafts. */
export async function importWorkflowAsProposal(
  cwd: string,
  workflow: WorkflowDefinition,
  createdBy?: string,
): Promise<{ proposal: Proposal; workflow: WorkflowDefinition }> {
  // Save the workflow definition
  await saveWorkflow(cwd, workflow);

  // Pass 1: Register all step IDs → tempIds
  const stepIdToTempId = new Map<string, string>();
  for (const step of workflow.steps) {
    stepIdToTempId.set(step.id, createId("draft"));
  }

  // Validate that all dependsOn references are valid
  for (const step of workflow.steps) {
    if (step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (!stepIdToTempId.has(depId)) {
          throw new Error(`Step "${step.id}" depends on unknown step "${depId}"`);
        }
      }
    }
  }

  // Pass 2: Build task drafts with resolved dependencies
  const taskDrafts: TaskDraft[] = [];
  for (const step of workflow.steps) {
    const tempId = stepIdToTempId.get(step.id)!;

    // Build task description
    let description = step.description || "";
    if (step.grpc) {
      description += (description ? "\n\n" : "") + buildGrpcInstruction(step.grpc);
    }
    if (step.shell) {
      description += (description ? "\n\n" : "") + `Shell Command: ${step.shell}`;
    }

    // Build acceptance criteria
    const acceptanceCriteria = [...(step.acceptanceCriteria || [])];
    if (step.grpc) {
      acceptanceCriteria.push(`gRPC call ${step.grpc.service}.${step.grpc.method} completed successfully`);
    }

    // Resolve dependencies (all tempIds are now registered)
    const dependsOnTempIds = step.dependsOn
      ?.map(depId => stepIdToTempId.get(depId))
      .filter(Boolean) as string[];

    taskDrafts.push({
      tempId,
      title: step.name,
      description: description.trim() || undefined,
      agent: step.agent || "grpc-worker",
      priority: "medium",
      dependsOnTempIds: dependsOnTempIds?.length > 0 ? dependsOnTempIds : undefined,
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
    });
  }

  // Create the proposal
  const proposal = await createProposal(cwd, {
    id: createId("proposal"),
    title: workflow.name,
    description: workflow.description || `Imported from workflow: ${workflow.name}`,
    inputType: "manual",
    status: "draft",
    taskDrafts,
    documentDrafts: [],
    createdBy,
  });

  return { proposal, workflow };
}

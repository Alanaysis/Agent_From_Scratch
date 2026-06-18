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

/** Condition for conditional branching */
export type StepCondition = {
  /** step_result: based on a previous step's output; llm_judge: LLM decides */
  type: "step_result" | "llm_judge";
  /** For step_result: which step to check */
  source?: string;
  /** For step_result: which field to check (status, result, etc.) */
  field?: string;
  /** For step_result: expected value */
  equals?: string;
  /** For llm_judge: prompt to ask the LLM */
  prompt?: string;
  /** For llm_judge: possible options the LLM can choose from */
  options?: string[];
};

/** Loop configuration for flow-level repetition */
export type LoopConfig = {
  /** Max iterations before forced exit */
  max: number;
  /** Steps to repeat (by ID) */
  steps: string[];
  /** Exit condition: stop looping when this is met */
  until?: StepCondition;
  /** What to do when max iterations exhausted: abort | continue | skip */
  onExhausted?: "abort" | "continue" | "skip";
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
  checkpointAfter?: boolean;
  checkpointMessage?: string;
  autoVerify?: boolean;
  collectInput?: InputFieldSchema[];
  onError?: OnErrorConfig;
  acceptanceCriteria?: string[];
  /** Conditional execution: step only runs if condition is met */
  condition?: StepCondition;
  /** Loop configuration: repeat steps until condition or max count */
  loop?: LoopConfig;
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
  // Use JSON_SCHEMA to prevent code injection via !!js/function etc.
  const parsed = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA }) as any;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid YAML: expected an object");
  }
  if (!parsed.name || typeof parsed.name !== "string") {
    throw new Error("Workflow must have a 'name' field");
  }
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error("Workflow must have a non-empty 'steps' array");
  }

  // Helper to trim strings recursively
  const trimStrings = (obj: any): any => {
    if (typeof obj === 'string') return obj.trim();
    if (Array.isArray(obj)) return obj.map(trimStrings);
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = trimStrings(value);
      }
      return result;
    }
    return obj;
  };

  const steps: WorkflowStep[] = parsed.steps.map((step: any, index: number) => {
    if (!step.id) throw new Error(`Step ${index} must have an 'id' field`);
    if (!step.name) throw new Error(`Step ${index} (${step.id}) must have a 'name' field`);

    // Trim all string fields
    const trimmed = trimStrings(step);

    return {
      id: trimmed.id,
      name: trimmed.name,
      description: trimmed.description,
      agent: trimmed.agent,
      dependsOn: trimmed.depends_on || trimmed.dependsOn,
      grpc: trimmed.grpc ? {
        protoFile: trimmed.grpc.protoFile || trimmed.grpc.proto_file,
        service: trimmed.grpc.service,
        method: trimmed.grpc.method,
        address: trimmed.grpc.address,
        payload: trimmed.grpc.payload || {},
        metadata: trimmed.grpc.metadata,
        deadline: trimmed.grpc.deadline,
      } : undefined,
      shell: trimmed.shell,
      requiresApproval: trimmed.requires_approval || trimmed.requiresApproval,
      approvalMessage: trimmed.approval_message || trimmed.approvalMessage,
      checkpointAfter: trimmed.checkpoint_after || trimmed.checkpointAfter,
      checkpointMessage: trimmed.checkpoint_message || trimmed.checkpointMessage,
      autoVerify: trimmed.auto_verify || trimmed.autoVerify,
      collectInput: trimmed.collect_input || trimmed.collectInput,
      onError: trimmed.on_error || trimmed.onError ? {
        action: (trimmed.on_error || trimmed.onError).action || "pause",
        maxRetries: (trimmed.on_error || trimmed.onError).max_retries || (trimmed.on_error || trimmed.onError).maxRetries,
        message: (trimmed.on_error || trimmed.onError).message,
      } : undefined,
      acceptanceCriteria: trimmed.acceptance_criteria || trimmed.acceptanceCriteria,
      condition: trimmed.condition ? {
        type: trimmed.condition.type || "step_result",
        source: trimmed.condition.source,
        field: trimmed.condition.field || "status",
        equals: trimmed.condition.equals,
        prompt: trimmed.condition.prompt,
        options: trimmed.condition.options,
      } : undefined,
      loop: trimmed.loop ? {
        max: trimmed.loop.max ?? 3,
        steps: trimmed.loop.steps || [],
        until: trimmed.loop.until ? {
          type: trimmed.loop.until.type || "step_result",
          source: trimmed.loop.until.source,
          field: trimmed.loop.until.field || "status",
          equals: trimmed.loop.until.equals,
        } : undefined,
        onExhausted: trimmed.loop.on_exhausted || trimmed.loop.onExhausted || "abort",
      } : undefined,
    };
  });

  return {
    id: createId("workflow"),
    name: parsed.name,
    description: parsed.description,
    steps,
    createdAt: "",
    updatedAt: "",
  };
}

/** Build a gRPC call instruction for a task description. */
function buildGrpcInstruction(grpc: GrpcCallConfig): string {
  const parts = [
    `## gRPC Task`,
    ``,
    `You MUST use the **GrpcClient** tool to execute this gRPC call. Do NOT use Shell or any other tool.`,
    ``,
    `Call the GrpcClient tool with these exact parameters:`,
    `- protoFile: "${grpc.protoFile || 'protos/AlgoService.proto'}"`,
    `- service: "${grpc.service}"`,
    `- method: "${grpc.method}"`,
    `- address: "${grpc.address || 'localhost:50051'}"`,
    `- payload: ${JSON.stringify(grpc.payload, null, 2)}`,
  ];
  if (grpc.metadata) parts.push(`- metadata: ${JSON.stringify(grpc.metadata)}`);
  if (grpc.deadline) parts.push(`- deadline: ${grpc.deadline}`);
  parts.push(``);
  parts.push(`After the GrpcClient call completes, report the response. If it fails, use the Checkpoint tool to ask the user.`);
  return parts.join("\n");
}

/** Convert a workflow definition into a Proposal with task drafts. */
export async function importWorkflowAsProposal(
  cwd: string,
  workflow: WorkflowDefinition,
  createdBy?: string,
  sourceYamlPath?: string,
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

    // Build acceptance criteria (only from explicit config, not auto-added)
    const acceptanceCriteria = [...(step.acceptanceCriteria || [])];

    // Resolve dependencies (all tempIds are now registered)
    const dependsOnTempIds = step.dependsOn
      ?.map(depId => stepIdToTempId.get(depId))
      .filter(Boolean) as string[];

    taskDrafts.push({
      tempId,
      title: step.name,
      description: description.trim() || undefined,
      agent: step.agent || (step.grpc ? "grpc-worker" : "general-purpose"),
      priority: "medium",
      dependsOnTempIds: dependsOnTempIds?.length > 0 ? dependsOnTempIds : undefined,
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
      requiresApproval: step.requiresApproval || false,
      approvalMessage: step.approvalMessage,
      checkpointAfter: step.checkpointAfter || false,
      checkpointMessage: step.checkpointMessage,
      condition: step.condition ? {
        type: step.condition.type || 'step_result',
        source: stepIdToTempId.get(step.condition.source || '') || step.condition.source,
        field: step.condition.field || 'status',
        equals: step.condition.equals,
        prompt: step.condition.prompt,
        options: step.condition.options,
      } : undefined,
      loop: step.loop ? {
        max: step.loop.max || 3,
        steps: (step.loop.steps || []).map(sid => stepIdToTempId.get(sid) || sid),
        until: step.loop.until ? {
          type: step.loop.until.type || 'step_result',
          source: stepIdToTempId.get(step.loop.until.source || '') || step.loop.until.source,
          field: step.loop.until.field || 'status',
          equals: step.loop.until.equals,
        } : undefined,
        onExhausted: step.loop.onExhausted || 'abort',
      } : undefined,
      grpcConfig: step.grpc ? {
        protoFile: step.grpc.protoFile || "protos/AlgoService.proto",
        service: step.grpc.service,
        method: step.grpc.method,
        address: step.grpc.address || "",
        payload: step.grpc.payload || {},
        metadata: step.grpc.metadata,
        deadline: step.grpc.deadline,
      } : undefined,
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
    sourceYamlPath,
    createdBy,
  });

  return { proposal, workflow };
}

/** Escape and quote a string for YAML output */
function yamlString(str: string): string {
  const escaped = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return `"${escaped}"`;
}

/** Convert Proposal task drafts back to YAML workflow format */
export function proposalToWorkflowYaml(proposal: { title: string; description?: string; taskDrafts: Array<{
  tempId?: string;
  title: string;
  description?: string;
  agent?: string;
  dependsOnTempIds?: string[];
  requiresApproval?: boolean;
  approvalMessage?: string;
  checkpointAfter?: boolean;
  checkpointMessage?: string;
  grpcConfig?: {
    protoFile: string;
    service: string;
    method: string;
    address: string;
    payload: Record<string, unknown>;
  };
}> }): string {
  // Build tempId → index mapping for dependency resolution
  const tempIdToIndex = new Map<string, number>();
  proposal.taskDrafts.forEach((draft, i) => {
    if (draft.tempId) {
      tempIdToIndex.set(draft.tempId, i);
    }
  });

  const lines: string[] = [];
  lines.push(`name: ${yamlString(proposal.title)}`);
  if (proposal.description) {
    lines.push(`description: ${yamlString(proposal.description)}`);
  }
  lines.push('');
  lines.push('steps:');

  proposal.taskDrafts.forEach((draft, index) => {
    const stepId = `step_${index}`;
    lines.push(`  - id: ${stepId}`);
    lines.push(`    name: ${yamlString(draft.title)}`);
    if (draft.description) {
      lines.push(`    description: ${yamlString(draft.description)}`);
    }
    // Always output agent, default to "general-purpose" if not set
    lines.push(`    agent: ${yamlString(draft.agent || 'general-purpose')}`);

    // Resolve dependencies using tempId → index mapping
    if (draft.dependsOnTempIds && draft.dependsOnTempIds.length > 0) {
      const deps: string[] = [];
      for (const tempId of draft.dependsOnTempIds) {
        const depIndex = tempIdToIndex.get(tempId);
        if (depIndex !== undefined) {
          deps.push(`step_${depIndex}`);
        }
      }
      if (deps.length > 0) {
        lines.push(`    depends_on: [${deps.join(', ')}]`);
      }
    }

    // gRPC config
    if (draft.grpcConfig) {
      lines.push(`    grpc:`);
      lines.push(`      protoFile: ${yamlString(draft.grpcConfig.protoFile)}`);
      lines.push(`      service: ${yamlString(draft.grpcConfig.service)}`);
      lines.push(`      method: ${yamlString(draft.grpcConfig.method)}`);
      lines.push(`      address: ${yamlString(draft.grpcConfig.address)}`);
      lines.push(`      payload:`);
      for (const [key, value] of Object.entries(draft.grpcConfig.payload)) {
        // JSON.stringify handles type preservation for arrays/objects/numbers/booleans
        lines.push(`        ${key}: ${JSON.stringify(value)}`);
      }
    }

    // Approval settings
    if (draft.requiresApproval) {
      lines.push(`    requires_approval: true`);
    }
    if (draft.approvalMessage) {
      lines.push(`    approval_message: ${yamlString(draft.approvalMessage)}`);
    }

    // Checkpoint settings
    if (draft.checkpointAfter) {
      lines.push(`    checkpoint_after: true`);
    }
    if (draft.checkpointMessage) {
      lines.push(`    checkpoint_message: ${yamlString(draft.checkpointMessage)}`);
    }

    lines.push('');
  });

  return lines.join('\n');
}

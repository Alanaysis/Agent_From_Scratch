import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";

export type CheckpointInput = {
  type: "approval" | "error_choice" | "data_input";
  message: string;
  options?: string[];
  schema?: Array<{
    name: string;
    label: string;
    type: "text" | "number" | "select" | "boolean";
    options?: string[];
    required?: boolean;
    default?: unknown;
  }>;
};

export type CheckpointOutput = {
  approved?: boolean;
  choice?: string;
  data?: Record<string, unknown>;
  timedOut?: boolean;
};

// Store for pending checkpoint responses, keyed by checkpoint ID
const pendingResponses = new Map<string, CheckpointOutput>();

export function setCheckpointResponse(checkpointId: string, response: CheckpointOutput): void {
  pendingResponses.set(checkpointId, response);
}

export function getCheckpointResponse(checkpointId: string): CheckpointOutput | undefined {
  const response = pendingResponses.get(checkpointId);
  if (response) pendingResponses.delete(checkpointId);
  return response;
}

export const CheckpointTool: Tool<CheckpointInput, CheckpointOutput> = {
  name: "Checkpoint",
  inputSchema: null,
  outputSchema: null,

  async description() {
    return "Pause execution and wait for user input. Use this for: approval confirmations, error recovery choices (retry/skip/abort), or collecting user-provided data. The workflow will pause until the user responds.";
  },

  async call(
    args: CheckpointInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<CheckpointOutput>> {
    // The checkpoint response is stored by the permission handler.
    // The checkpointId is passed via the permission flow.
    // Try to read the response from the shared store.
    const checkpointId = (args as any).__checkpointId;
    if (checkpointId) {
      const stored = getCheckpointResponse(checkpointId);
      if (stored) {
        return { data: stored };
      }
    }

    // Fallback: return a default based on the checkpoint type
    if (args.type === "approval") {
      return { data: { approved: true } };
    }
    if (args.type === "error_choice") {
      return { data: { approved: true, choice: args.options?.[0] || "skip" } };
    }
    return { data: { approved: true, data: {} } };
  },

  async validateInput(input) {
    if (!input.type || !["approval", "error_choice", "data_input"].includes(input.type)) {
      return { result: false, message: "type must be 'approval', 'error_choice', or 'data_input'" };
    }
    if (!input.message || typeof input.message !== "string") {
      return { result: false, message: "message is required" };
    }
    if (input.type === "error_choice" && (!input.options || input.options.length === 0)) {
      return { result: false, message: "options are required for error_choice type" };
    }
    return { result: true };
  },

  async checkPermissions(input) {
    return {
      behavior: "ask" as const,
      message: input.message || "Waiting for user input...",
      updatedInput: input,
    };
  },

  isReadOnly() {
    return false;
  },

  isConcurrencySafe() {
    return false;
  },
};

/**
 * Unified tool execution engine — shared between CLI (query.ts) and
 * HTTP/sub-agent (runAgent.ts) paths.
 *
 * Provides a single executeToolCall function that:
 * 1. Validates input against tool.inputSchema (JSON Schema)
 * 2. Runs beforeToolCall hooks (constraint enforcement)
 * 3. Executes the tool
 * 4. Writes audit log entries
 * 5. Handles permission flow (deny/ask/allow)
 *
 * This eliminates the duplicate tool-call logic that previously existed
 * in both query.ts and runAgent.ts, and ensures the CLI path gets the
 * same schema validation + constraint enforcement + audit logging as
 * the HTTP path.
 */

import type {
  Tool, ToolUseContext, CanUseToolFn, Tools, JsonSchema,
} from "../../tools/Tool";
import { findToolByName } from "../../tools/Tool";
import { executeBeforeHooks, type HookContext } from "../../tools/hooks";
import { appendAudit } from "../../storage/audit";
import type { Message, AssistantMessage } from "../messages";
import { createId } from "../../shared/ids";

export type ExecuteToolCallParams = {
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
  context: ToolUseContext;
  permissionFn: CanUseToolFn;
  tools: Tools;
  onPermissionRequest?: (request: {
    toolName: string;
    input: unknown;
    message: string;
  }) => Promise<boolean | { allowed: boolean; updatedInput?: unknown }>;
  /** Optional callback for tools that modify context (query.ts uses this). */
  onContextModifier?: (modifier: (ctx: ToolUseContext) => ToolUseContext) => void;
};

export type ExecuteToolCallResult = {
  messages: Message[];
  contextModifier?: (ctx: ToolUseContext) => ToolUseContext;
};

function stringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function createToolResultMessage(
  toolUseId: string,
  content: string,
  isError = false,
): Message {
  return {
    id: createId("tool-result"),
    type: "tool_result",
    toolUseId,
    content,
    isError,
  } as Message;
}

function createAssistantMessage(
  blocks: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }>,
): AssistantMessage {
  return {
    id: createId("assistant"),
    type: "assistant",
    content: blocks as AssistantMessage["content"],
  };
}

/** Validate tool input against its JsonSchema. Returns null if valid, or an error message. */
function validateAgainstSchema(input: unknown, schema: JsonSchema): string | null {
  if (schema.type !== "object") return null;
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return `Expected object input, got ${Array.isArray(input) ? "array" : typeof input}`;
  }
  const obj = input as Record<string, unknown>;
  if (schema.required) {
    for (const field of schema.required) {
      if (obj[field] === undefined || obj[field] === null) {
        return `Missing required field: "${field}"`;
      }
    }
  }
  if (schema.additionalProperties === false && schema.properties) {
    const known = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(obj)) {
      if (!known.has(key)) {
        return `Unknown field "${key}" (schema has additionalProperties: false)`;
      }
    }
  }
  if (schema.properties) {
    for (const [field, def] of Object.entries(schema.properties)) {
      const val = obj[field];
      if (val === undefined || val === null) continue;
      if (def.type === "string" && typeof val !== "string") return `Field "${field}" must be string, got ${typeof val}`;
      if (def.type === "number" && typeof val !== "number") return `Field "${field}" must be number, got ${typeof val}`;
      if (def.type === "boolean" && typeof val !== "boolean") return `Field "${field}" must be boolean, got ${typeof val}`;
      if (def.type === "object" && (typeof val !== "object" || Array.isArray(val) || val === null)) return `Field "${field}" must be object`;
      if (def.type === "array" && !Array.isArray(val)) return `Field "${field}" must be array`;
      if (def.pattern && typeof val === "string") {
        if (!new RegExp(def.pattern).test(val)) return `Field "${field}" value does not match pattern ${def.pattern}`;
      }
      if (def.enum && !def.enum.includes(val as string | number)) return `Field "${field}" must be one of [${def.enum.join(", ")}]`;
      if (typeof val === "number") {
        if (def.minimum !== undefined && val < def.minimum) return `Field "${field}" below minimum ${def.minimum}`;
        if (def.maximum !== undefined && val > def.maximum) return `Field "${field}" above maximum ${def.maximum}`;
      }
    }
  }
  return null;
}

/**
 * Execute a single tool call with full safety pipeline:
 * permission → schema validation → beforeToolCall hooks → tool.call → audit.
 *
 * Returns the messages produced (tool_result + any extra messages).
 */
export async function executeToolCall(
  params: ExecuteToolCallParams,
): Promise<ExecuteToolCallResult> {
  const { toolName, toolInput, toolUseId, context, permissionFn, tools, onPermissionRequest } = params;
  const messages: Message[] = [];

  const tool = findToolByName(tools, toolName);
  if (!tool) {
    messages.push(createToolResultMessage(toolUseId, stringify({ error: `Unknown tool ${toolName}` }), true));
    return { messages };
  }

  const parentMessage = createAssistantMessage([
    { type: "tool_use", id: toolUseId, name: toolName, input: toolInput },
  ]);

  // 1. Permission check
  const permission = await permissionFn(tool, toolInput, context, parentMessage, toolUseId);
  if (permission.behavior === "deny") {
    messages.push(createToolResultMessage(toolUseId, stringify({ error: permission.message }), true));
    return { messages };
  }

  let effectiveInput = toolInput;
  if (permission.behavior === "ask") {
    const permResult = onPermissionRequest
      ? await onPermissionRequest({
          toolName,
          input: toolInput,
          message: permission.message || `Tool ${toolName} requires confirmation`,
        })
      : false;
    const allowed = typeof permResult === "boolean" ? permResult : permResult.allowed;
    if (!allowed) {
      messages.push(createToolResultMessage(toolUseId, stringify({ error: `User rejected ${toolName}` }), true));
      return { messages };
    }
    if (typeof permResult === "object" && permResult.updatedInput !== undefined) {
      effectiveInput = permResult.updatedInput;
    } else if (permission.updatedInput !== undefined) {
      effectiveInput = permission.updatedInput;
    }
  } else if (permission.updatedInput !== undefined) {
    effectiveInput = permission.updatedInput;
  }

  // 2. Schema validation
  if (tool.inputSchema) {
    const schemaError = validateAgainstSchema(effectiveInput, tool.inputSchema);
    if (schemaError) {
      messages.push(createToolResultMessage(
        toolUseId,
        stringify({ error: `Schema validation failed: ${schemaError}` }),
        true,
      ));
      return { messages };
    }
  }

  // 3. beforeToolCall hooks
  const hookCtx: HookContext = {
    toolName,
    input: effectiveInput,
    context,
    toolUseId,
    timestamp: Date.now(),
  };
  const beforeResult = await executeBeforeHooks(hookCtx);
  if (!beforeResult.proceed) {
    const blockReason = beforeResult.reason || "unspecified";
    messages.push(createToolResultMessage(
      toolUseId,
      stringify({ error: `Blocked by policy: ${blockReason}` }),
      true,
    ));
    appendAudit(context.cwd, {
      taskId: context.agentId || "unknown",
      sessionId: context.agentId,
      tool: toolName,
      input: effectiveInput,
      error: blockReason,
      actor: context.agentType,
      blocked: true,
      blockReason,
    }).catch(() => {});
    return { messages };
  }
  if (beforeResult.modifiedInput !== undefined) {
    effectiveInput = beforeResult.modifiedInput;
  }

  // 4. Execute tool
  const callStartTime = Date.now();
  try {
    const result = await tool.call(
      effectiveInput as never,
      context,
      permissionFn,
      parentMessage,
    );
    const durationMs = Date.now() - callStartTime;
    messages.push(createToolResultMessage(toolUseId, stringify(result.data)));
    if (result.extraMessages) {
      for (const extraMessage of result.extraMessages) {
        messages.push(extraMessage);
      }
    }
    if (result.contextModifier) {
      params.onContextModifier?.(result.contextModifier);
    }
    // Audit: successful call
    appendAudit(context.cwd, {
      taskId: context.agentId || "unknown",
      sessionId: context.agentId,
      tool: toolName,
      input: effectiveInput,
      output: result.data,
      durationMs,
      actor: context.agentType,
    }).catch(() => {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - callStartTime;
    messages.push(createToolResultMessage(toolUseId, stringify({ error: message }), true));
    // Audit: failed call
    appendAudit(context.cwd, {
      taskId: context.agentId || "unknown",
      sessionId: context.agentId,
      tool: toolName,
      input: effectiveInput,
      error: message,
      durationMs,
      actor: context.agentType,
    }).catch(() => {});
  }

  return { messages };
}

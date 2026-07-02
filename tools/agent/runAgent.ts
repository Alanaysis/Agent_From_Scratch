import { createId } from "../../shared/ids";
import type { Message, AssistantMessage } from "../../runtime/messages";
import { getLlmConfig, runLlmTurn, type LlmToolDefinition } from "../../runtime/llm";
import { createSubagentContext, type SubagentContextOverrides } from "./subagentContext";
import { getAgentDefinition, getToolDefinitionsForAgent } from "./agentRegistry";
import { compressSubagentResult } from "./resultCompressor";
import { findToolByName, type CanUseToolFn, type ToolUseContext, type Tools, type JsonSchema } from "../Tool";
import { getTools } from "../registry";
import { canUseTool } from "../../permissions/engine";
import { executeBeforeHooks, type HookContext } from "../hooks";
import { appendAudit } from "../../storage/audit";

export type RunAgentParams = {
  description: string;
  prompt: string;
  subagentType?: string;
  parentContext: ToolUseContext;
  canUseTool?: CanUseToolFn;
  maxTurns?: number;
  onProgress?: (text: string) => void;
  onMessage?: (message: Message) => void | Promise<void>;
  onPermissionRequest?: (request: {
    toolName: string;
    input: unknown;
    message: string;
  }) => Promise<boolean | { allowed: boolean; updatedInput?: unknown }>;
};

function buildSubagentSystemPrompt(agentDef: ReturnType<typeof getAgentDefinition>): string[] {
  return [
    ...agentDef.systemPrompt,
    "IMPORTANT: You are a sub-agent. You cannot launch other sub-agents. Complete your task independently.",
    "When you finish, provide a concise summary of your findings or actions as your final message.",
  ];
}

function getFilteredTools(agentDef: ReturnType<typeof getAgentDefinition>): Tools {
  const allTools = getTools();
  const blockedTools = ["Agent", "Team", "Reflect", "Skill"];
  if (agentDef.allowedTools === "*") {
    return allTools.filter((t) => !blockedTools.includes(t.name));
  }
  return allTools.filter(
    (t) => agentDef.allowedTools.includes(t.name) && !blockedTools.includes(t.name),
  );
}

/**
 * Convert a Tool's JsonSchema inputSchema into an LlmToolDefinition.
 * The description is derived from the schema's description (if present),
 * otherwise the caller should fall back to a hand-written definition.
 */
function toolToLlmDefinition(
  name: string,
  schema: JsonSchema,
  description: string,
): LlmToolDefinition {
  return {
    name,
    description,
    parameters: schema as unknown as Record<string, unknown>,
  };
}

/** Names of tools whose inputSchema is authoritative (auto-generated from schema).
 *  Tools not in this set still use the hand-written definitions below. */
const SCHEMA_DRIVEN_TOOLS = new Set(["GrpcClient"]);

function getSubagentToolDefinitions(
  agentDef: ReturnType<typeof getAgentDefinition>,
): LlmToolDefinition[] {
  const allDefs = buildAllToolDefinitions();
  return getToolDefinitionsForAgent(agentDef, allDefs);
}

function buildAllToolDefinitions(): LlmToolDefinition[] {
  const handWritten: LlmToolDefinition[] = [
    {
      name: "Read",
      description: "Read a text file from the current working directory.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative or absolute file path." },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "Write",
      description: "Write text content to a file, creating or overwriting it.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to write." },
          content: { type: "string", description: "Full file content." },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
    {
      name: "Edit",
      description: "Replace one string with another inside a file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to edit." },
          oldString: { type: "string", description: "Existing text to replace." },
          newString: { type: "string", description: "Replacement text." },
        },
        required: ["path", "oldString", "newString"],
        additionalProperties: false,
      },
    },
    {
      name: "Shell",
      description: "Run a shell command in the current working directory.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute." },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
    {
      name: "WebFetch",
      description: "Fetch a URL and return a processed text snippet.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "HTTP or HTTPS URL." },
          prompt: { type: "string", description: "Optional guidance describing what to extract from the page." },
        },
        required: ["url", "prompt"],
        additionalProperties: false,
      },
    },
    {
      name: "WebSearch",
      description: "Search the web using DuckDuckGo.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "FileTree",
      description: "List directory tree structure.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path." },
          maxDepth: { type: "number", description: "Maximum depth to traverse." },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "SearchFiles",
      description: "Search files by name pattern or content regex.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["files", "content"], description: "Search mode." },
          pattern: { type: "string", description: "Glob pattern or regex." },
          path: { type: "string", description: "Directory to search in." },
        },
        required: ["mode", "pattern"],
        additionalProperties: false,
      },
    },
    {
      name: "Checkpoint",
      description: "Pause execution and wait for user input. Use for approval confirmations, error recovery choices (retry/skip/abort), or collecting user-provided data.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["approval", "error_choice", "data_input"], description: "Type of checkpoint." },
          message: { type: "string", description: "Message to show to the user." },
          options: { type: "array", items: { type: "string" }, description: "Options for error_choice type (e.g. ['retry', 'skip', 'abort'])." },
          schema: { type: "array", description: "Field definitions for data_input type.", items: { type: "object", properties: { name: { type: "string" }, label: { type: "string" }, type: { type: "string" }, options: { type: "array", items: { type: "string" } }, required: { type: "boolean" } } } },
        },
        required: ["type", "message"],
        additionalProperties: false,
      },
    },
    {
      name: "TaskCreate",
      description: "Create a new task in the task management system.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title." },
          description: { type: "string", description: "Task description." },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority." },
          assignee: { type: "string", description: "Agent to assign (e.g. 'general-purpose', 'grpc-worker')." },
          dependsOn: { type: "array", items: { type: "string" }, description: "Task IDs this task depends on." },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  ];

  // Merge: schema-driven tools (from Tool.inputSchema) override hand-written ones.
  // This lets tools own their schema in one place (the Tool definition) and
  // have it flow automatically to the LLM tool definition.
  const schemaDriven = getTools()
    .filter(t => t.inputSchema && SCHEMA_DRIVEN_TOOLS.has(t.name))
    .map(t => toolToLlmDefinition(t.name, t.inputSchema!, t.inputSchema!.description || t.name));

  const merged = new Map<string, LlmToolDefinition>();
  for (const def of handWritten) merged.set(def.name, def);
  for (const def of schemaDriven) merged.set(def.name, def); // schema wins
  return [...merged.values()];
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

function stringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

/** Validate tool input against its JsonSchema. Returns null if valid, or an error message. */
function validateAgainstSchema(input: unknown, schema: JsonSchema): string | null {
  if (schema.type !== "object") return null; // only object schemas validated here
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return `Expected object input, got ${Array.isArray(input) ? "array" : typeof input}`;
  }
  const obj = input as Record<string, unknown>;
  // required
  if (schema.required) {
    for (const field of schema.required) {
      if (obj[field] === undefined || obj[field] === null) {
        return `Missing required field: "${field}"`;
      }
    }
  }
  // additionalProperties: false — reject unknown fields
  if (schema.additionalProperties === false && schema.properties) {
    const known = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(obj)) {
      if (!known.has(key)) {
        return `Unknown field "${key}" (schema has additionalProperties: false)`;
      }
    }
  }
  // per-field type + pattern checks
  if (schema.properties) {
    for (const [field, def] of Object.entries(schema.properties)) {
      const val = obj[field];
      if (val === undefined || val === null) continue;
      if (def.type === "string" && typeof val !== "string") {
        return `Field "${field}" must be string, got ${typeof val}`;
      }
      if (def.type === "number" && typeof val !== "number") {
        return `Field "${field}" must be number, got ${typeof val}`;
      }
      if (def.type === "boolean" && typeof val !== "boolean") {
        return `Field "${field}" must be boolean, got ${typeof val}`;
      }
      if (def.type === "object" && (typeof val !== "object" || Array.isArray(val) || val === null)) {
        return `Field "${field}" must be object, got ${Array.isArray(val) ? "array" : typeof val}`;
      }
      if (def.type === "array" && !Array.isArray(val)) {
        return `Field "${field}" must be array, got ${typeof val}`;
      }
      if (def.pattern && typeof val === "string") {
        const re = new RegExp(def.pattern);
        if (!re.test(val)) {
          return `Field "${field}" value "${val.slice(0, 50)}" does not match pattern ${def.pattern}`;
        }
      }
      if (def.enum && !def.enum.includes(val as string | number)) {
        return `Field "${field}" value must be one of [${def.enum.join(", ")}], got "${val}"`;
      }
      if (typeof val === "number") {
        if (def.minimum !== undefined && val < def.minimum) {
          return `Field "${field}" value ${val} is below minimum ${def.minimum}`;
        }
        if (def.maximum !== undefined && val > def.maximum) {
          return `Field "${field}" value ${val} is above maximum ${def.maximum}`;
        }
      }
    }
  }
  return null;
}

async function* executeSubagentToolCall(
  toolName: string,
  toolInput: unknown,
  toolUseId: string,
  context: ToolUseContext,
  permissionFn: CanUseToolFn,
  filteredTools: Tools,
  onPermissionRequest?: RunAgentParams["onPermissionRequest"],
): AsyncGenerator<Message, void> {
  const tool = findToolByName(filteredTools, toolName);
  if (!tool) {
    yield createToolResultMessage(toolUseId, stringify({ error: `Unknown tool ${toolName}` }), true);
    return;
  }

  const parentMessage = createAssistantMessage([
    { type: "tool_use", id: toolUseId, name: toolName, input: toolInput },
  ]);

  const permission = await permissionFn(tool, toolInput, context, parentMessage, toolUseId);

  if (permission.behavior === "deny") {
    yield createToolResultMessage(toolUseId, stringify({ error: permission.message }), true);
    return;
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
    const allowed = typeof permResult === 'boolean' ? permResult : permResult.allowed;
    if (!allowed) {
      yield createToolResultMessage(
        toolUseId,
        stringify({ error: `User rejected ${toolName}` }),
        true,
      );
      return;
    }
    // onPermissionRequest can override input (e.g. inject checkpointId)
    if (typeof permResult === 'object' && permResult.updatedInput !== undefined) {
      effectiveInput = permResult.updatedInput;
    } else if (permission.updatedInput !== undefined) {
      effectiveInput = permission.updatedInput;
    }
  } else if (permission.updatedInput !== undefined) {
    effectiveInput = permission.updatedInput;
  }

  // Schema validation (beforeToolCall constraint layer #1):
  // Tools with a JsonSchema inputSchema get validated here, before any hook
  // or tool execution. Invalid input is rejected without reaching the tool.
  if (tool.inputSchema) {
    const schemaError = validateAgainstSchema(effectiveInput, tool.inputSchema);
    if (schemaError) {
      yield createToolResultMessage(
        toolUseId,
        stringify({ error: `Schema validation failed: ${schemaError}` }),
        true,
      );
      return;
    }
  }

  // beforeToolCall hooks (constraint layer #2):
  // Registered hooks (e.g. ToolRouter constraint enforcement) can block or
  // modify the input. Runs AFTER schema validation so hooks see clean input.
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
    yield createToolResultMessage(
      toolUseId,
      stringify({ error: `Blocked by policy: ${blockReason}` }),
      true,
    );
    // Audit: blocked call
    appendAudit(context.cwd, {
      taskId: context.agentId || "unknown",
      sessionId: context.agentId,
      tool: toolName,
      input: effectiveInput,
      error: blockReason,
      actor: context.agentType,
      blocked: true,
      blockReason,
    }).catch(() => {}); // fire-and-forget
    return;
  }
  if (beforeResult.modifiedInput !== undefined) {
    effectiveInput = beforeResult.modifiedInput;
  }

  const callStartTime = Date.now();
  try {
    const result = await tool.call(
      effectiveInput as never,
      context,
      permissionFn,
      parentMessage,
    );
    const durationMs = Date.now() - callStartTime;
    yield createToolResultMessage(toolUseId, stringify(result.data));
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
    if (result.extraMessages) {
      for (const extraMessage of result.extraMessages) {
        yield extraMessage;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - callStartTime;
    yield createToolResultMessage(toolUseId, stringify({ error: message }), true);
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
}

export async function runAgent(params: RunAgentParams): Promise<string> {
  const agentDef = getAgentDefinition(params.subagentType);
  const maxTurns = params.maxTurns ?? agentDef.maxTurns ?? 8;
  const permissionFn = params.canUseTool ?? canUseTool;

  const subContext = createSubagentContext(params.parentContext, {
    agentType: agentDef.name,
    shareAbortController: true,
  });
  const signal = subContext.abortController.signal;

  const filteredTools = getFilteredTools(agentDef);

  if (!getLlmConfig()?.apiKey) {
    console.log(`[runAgent] No LLM API key configured, returning early`)
    return [
      `Subagent "${agentDef.name}" accepted the task.`,
      `Description: ${params.description}`,
      `Prompt length: ${params.prompt.length} characters`,
      "No LLM configured — subagent cannot execute without a model.",
    ].join("\n");
  }

  console.log(`[runAgent] Starting agent "${agentDef.name}" for: ${params.description}`)

  const messages: Message[] = [
    { id: createId("user"), type: "user", content: params.prompt } as Message,
  ];

  const systemPrompt = buildSubagentSystemPrompt(agentDef);

  // Inject irg.md project instructions + referenced documents
  try {
    const { getFullInjectionContent } = await import("../../storage/irgMd");
    const irgContent = await getFullInjectionContent(params.parentContext.cwd);
    if (irgContent.trim()) {
      systemPrompt.push(irgContent);
    }
  } catch {
    // irg.md loading is best-effort
  }

  const toolDefs = getSubagentToolDefinitions(agentDef);
  const allResultMessages: Message[] = [];

  if (params.onMessage) {
    for (const msg of messages) {
      await params.onMessage(msg);
    }
  }

  for (let turn = 0; turn < maxTurns; turn += 1) {
    if (signal.aborted) {
      console.log(`[runAgent] Aborted before turn ${turn + 1}`);
      break;
    }
    console.log(`[runAgent] Turn ${turn + 1}/${maxTurns}`)
    const llmResponse = await runLlmTurn({
      messages,
      systemPrompt,
      tools: toolDefs,
      onTextDelta: params.onProgress,
      signal,
    });

    if (signal.aborted) {
      console.log(`[runAgent] Aborted during LLM turn ${turn + 1}`);
      break;
    }

    if (!llmResponse.text && llmResponse.toolCalls.length === 0) {
      break;
    }

    const assistantBlocks: AssistantMessage["content"] = [];
    if (llmResponse.text) {
      assistantBlocks.push({ type: "text", text: llmResponse.text });
    }
    for (const toolCall of llmResponse.toolCalls) {
      assistantBlocks.push({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
      });
    }

    const assistantMessage = createAssistantMessage(assistantBlocks);
    messages.push(assistantMessage);
    allResultMessages.push(assistantMessage);
    if (params.onMessage) {
      await params.onMessage(assistantMessage);
    }

    const toolCalls = assistantBlocks.filter(
      (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use",
    );

    if (toolCalls.length === 0) {
      break;
    }

    for (const toolCall of toolCalls) {
      if (signal.aborted) {
        console.log(`[runAgent] Aborted before tool ${toolCall.name}`);
        break;
      }
      for await (const msg of executeSubagentToolCall(
        toolCall.name,
        toolCall.input,
        toolCall.id,
        subContext,
        permissionFn,
        filteredTools,
        params.onPermissionRequest,
      )) {
        messages.push(msg);
        allResultMessages.push(msg);
        if (params.onMessage) {
          await params.onMessage(msg);
        }
      }
    }
  }

  console.log(`[runAgent] Completed, total messages: ${allResultMessages.length}`)
  return compressSubagentResult(allResultMessages);
}

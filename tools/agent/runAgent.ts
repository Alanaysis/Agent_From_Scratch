import { createId } from "../../shared/ids";
import type { Message, AssistantMessage } from "../../runtime/messages";
import { getLlmConfig, runLlmTurn, type LlmToolDefinition } from "../../runtime/llm";
import { createSubagentContext, type SubagentContextOverrides } from "./subagentContext";
import { getAgentDefinition, getToolDefinitionsForAgent } from "./agentRegistry";
import { compressSubagentResult } from "./resultCompressor";
import { findToolByName, type CanUseToolFn, type ToolUseContext, type Tools } from "../Tool";
import { getTools } from "../registry";
import { canUseTool } from "../../permissions/engine";

export type RunAgentParams = {
  description: string;
  prompt: string;
  subagentType?: string;
  parentContext: ToolUseContext;
  canUseTool?: CanUseToolFn;
  maxTurns?: number;
  onProgress?: (text: string) => void;
  onMessage?: (message: Message) => void | Promise<void>;
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

function getSubagentToolDefinitions(
  agentDef: ReturnType<typeof getAgentDefinition>,
): LlmToolDefinition[] {
  const allDefs = buildAllToolDefinitions();
  return getToolDefinitionsForAgent(agentDef, allDefs);
}

function buildAllToolDefinitions(): LlmToolDefinition[] {
  return [
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
      name: "GrpcClient",
      description: "Make a gRPC call to an external service. Requires a .proto file, service name, method name, and target address.",
      parameters: {
        type: "object",
        properties: {
          protoFile: { type: "string", description: "Path to the .proto file." },
          service: { type: "string", description: "Fully qualified service name (e.g. 'mypackage.MyService')." },
          method: { type: "string", description: "Method name to call." },
          address: { type: "string", description: "Target address in host:port format." },
          payload: { type: "object", description: "Request payload as key-value pairs." },
          metadata: { type: "object", description: "Optional gRPC metadata as key-value pairs." },
          deadline: { type: "number", description: "Optional timeout in milliseconds (default 300000, i.e. 5 minutes)." },
        },
        required: ["service", "method", "address", "payload"],
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
  ];
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

async function* executeSubagentToolCall(
  toolName: string,
  toolInput: unknown,
  toolUseId: string,
  context: ToolUseContext,
  permissionFn: CanUseToolFn,
  filteredTools: Tools,
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
  if (permission.updatedInput !== undefined) {
    effectiveInput = permission.updatedInput;
  }

  try {
    const result = await tool.call(
      effectiveInput as never,
      context,
      permissionFn,
      parentMessage,
    );
    yield createToolResultMessage(toolUseId, stringify(result.data));
    if (result.extraMessages) {
      for (const extraMessage of result.extraMessages) {
        yield extraMessage;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield createToolResultMessage(toolUseId, stringify({ error: message }), true);
  }
}

export async function runAgent(params: RunAgentParams): Promise<string> {
  const agentDef = getAgentDefinition(params.subagentType);
  const maxTurns = params.maxTurns ?? agentDef.maxTurns ?? 8;
  const permissionFn = params.canUseTool ?? canUseTool;

  const subContext = createSubagentContext(params.parentContext, {
    agentType: agentDef.name,
  });

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
  const toolDefs = getSubagentToolDefinitions(agentDef);
  const allResultMessages: Message[] = [];

  if (params.onMessage) {
    for (const msg of messages) {
      await params.onMessage(msg);
    }
  }

  for (let turn = 0; turn < maxTurns; turn += 1) {
    console.log(`[runAgent] Turn ${turn + 1}/${maxTurns}`)
    const llmResponse = await runLlmTurn({
      messages,
      systemPrompt,
      tools: toolDefs,
      onTextDelta: params.onProgress,
    });

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
      for await (const msg of executeSubagentToolCall(
        toolCall.name,
        toolCall.input,
        toolCall.id,
        subContext,
        permissionFn,
        filteredTools,
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

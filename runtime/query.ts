import { createId } from "../shared/ids";
import {
  findToolByName,
  type CanUseToolFn,
  type ToolUseContext,
} from "../tools/Tool";
import { getTools } from "../tools/registry";
import { getLlmConfigFromEnv, runLlmTurn, type LlmToolDefinition } from "./llm";
import type {
  AssistantMessage,
  AssistantTextBlock,
  AssistantToolUseBlock,
  Message,
  ToolResultMessage,
} from "./messages";

export type QueryParams = {
  prompt: string;
  messages: Message[];
  systemPrompt: string[];
  toolUseContext: ToolUseContext;
  canUseTool: CanUseToolFn;
  maxTurns?: number;
  onAssistantTextDelta?: (text: string) => void;
  onPermissionRequest?: (request: {
    toolName: string;
    input: unknown;
    message: string;
  }) => Promise<boolean>;
};

type PlannedAction =
  | {
      kind: "tool";
      toolName: string;
      input: unknown;
      intro: string;
      summarizeResult: (result: unknown) => string;
      summarizeError: (message: string) => string;
    }
  | {
      kind: "text";
      text: string;
    };

function truncate(value: string, maxLength = 500): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n...`;
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function createAssistantMessage(
  blocks: Array<AssistantTextBlock | AssistantToolUseBlock>,
): AssistantMessage {
  return {
    id: createId("assistant"),
    type: "assistant",
    content: blocks,
  };
}

function createAssistantTextMessage(text: string): AssistantMessage {
  return createAssistantMessage([
    {
      type: "text",
      text,
    },
  ]);
}

function createToolResultMessage(
  toolUseId: string,
  content: string,
  isError = false,
): ToolResultMessage {
  return {
    id: createId("tool-result"),
    type: "tool_result",
    toolUseId,
    content,
    isError,
  };
}

function summarizeReadResult(result: unknown): string {
  const content =
    typeof result === "object" &&
    result !== null &&
    "content" in result &&
    typeof result.content === "string"
      ? result.content
      : stringify(result);
  return `我已经读取了目标内容。下面是预览：\n\n${truncate(content, 1200)}`;
}

function summarizeShellResult(result: unknown): string {
  if (
    typeof result === "object" &&
    result !== null &&
    "stdout" in result &&
    "stderr" in result &&
    "exitCode" in result
  ) {
    const stdout =
      typeof result.stdout === "string" ? truncate(result.stdout, 800) : "";
    const stderr =
      typeof result.stderr === "string" ? truncate(result.stderr, 400) : "";
    const exitCode =
      typeof result.exitCode === "number" ? result.exitCode : "unknown";
    return [
      `命令已执行，退出码：${exitCode}。`,
      stdout ? `stdout:\n${stdout}` : "",
      stderr ? `stderr:\n${stderr}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  return `命令已执行。\n\n${truncate(stringify(result), 1200)}`;
}

function planPrompt(prompt: string): PlannedAction {
  const trimmed = prompt.trim();
  const readMatch =
    trimmed.match(/^(?:read|open|show|cat)\s+(.+)$/i) ??
    trimmed.match(/^(?:读取|查看|打开)\s+(.+)$/);
  if (readMatch) {
    const path = readMatch[1].trim().replace(/^["']|["']$/g, "");
    return {
      kind: "tool",
      toolName: "Read",
      input: { path },
      intro: `我会先读取 \`${path}\`。`,
      summarizeResult: summarizeReadResult,
      summarizeError: (message) => `读取 \`${path}\` 失败：${message}`,
    };
  }

  const shellMatch =
    trimmed.match(/^(?:run|exec|execute|shell|bash)\s+(.+)$/i) ??
    trimmed.match(/^(?:执行|运行命令)\s+(.+)$/);
  if (shellMatch) {
    const command = shellMatch[1].trim();
    return {
      kind: "tool",
      toolName: "Shell",
      input: { command },
      intro: `我会执行命令：\`${command}\`。`,
      summarizeResult: summarizeShellResult,
      summarizeError: (message) => `命令执行失败：${message}`,
    };
  }

  const fetchMatch =
    trimmed.match(
      /^(?:fetch|visit|open-url)\s+(https?:\/\/\S+)(?:\s+(.+))?$/i,
    ) ?? trimmed.match(/^(?:抓取|访问)\s+(https?:\/\/\S+)(?:\s+(.+))?$/);
  if (fetchMatch) {
    const url = fetchMatch[1];
    const fetchPrompt = fetchMatch[2]?.trim() ?? "";
    return {
      kind: "tool",
      toolName: "WebFetch",
      input: { url, prompt: fetchPrompt },
      intro: `我会抓取 ${url}。`,
      summarizeResult: (result) =>
        `网页抓取完成。以下是结果预览：\n\n${truncate(stringify(result), 1200)}`,
      summarizeError: (message) => `抓取 ${url} 失败：${message}`,
    };
  }

  const writeMatch =
    trimmed.match(/^(?:write|create|save)\s+(\S+)\s+(.+)$/i) ??
    trimmed.match(/^(?:写入|创建文件)\s+(\S+)\s+(.+)$/);
  if (writeMatch) {
    const path = writeMatch[1].trim();
    const content = writeMatch[2];
    return {
      kind: "tool",
      toolName: "Write",
      input: { path, content },
      intro: `我会把内容写入 \`${path}\`。`,
      summarizeResult: (result) =>
        `写入完成：\`${path}\`。\n\n${stringify(result)}`,
      summarizeError: (message) => `写入 \`${path}\` 失败：${message}`,
    };
  }

  const editMatch =
    trimmed.match(/^(?:edit|replace)\s+(\S+)\s+(.+?)\s*(?:=>|->)\s*(.+)$/i) ??
    trimmed.match(/^(?:编辑|替换)\s+(\S+)\s+(.+?)\s*(?:=>|->|为)\s*(.+)$/);
  if (editMatch) {
    const path = editMatch[1].trim();
    const oldString = editMatch[2];
    const newString = editMatch[3];
    return {
      kind: "tool",
      toolName: "Edit",
      input: { path, oldString, newString },
      intro: `我会编辑 \`${path}\`，替换指定内容。`,
      summarizeResult: () => `编辑完成：\`${path}\` 已更新。`,
      summarizeError: (message) => `编辑 \`${path}\` 失败：${message}`,
    };
  }

  return {
    kind: "text",
    text: [
      "我现在支持一组本地 agent 动作，但当前没有可用的远程 LLM 配置。",
      "你可以设置这些环境变量来接入兼容 OpenAI Chat Completions 的模型：",
      "- `CCL_LLM_API_KEY`",
      "- `CCL_LLM_MODEL`",
      "- `CCL_LLM_BASE_URL` 可选，默认 `https://api.openai.com/v1`",
      "在未配置 LLM 时，也可以直接给我这些格式的提示：",
      "- `read README.md`",
      "- `run pwd`",
      "- `fetch https://example.com`",
      "- `write notes.txt hello world`",
      "- `edit notes.txt hello => hi`",
      "也可以输入 `/help` 查看 TUI 内建命令。",
    ].join("\n"),
  };
}

function getDefaultSystemPrompt(): string[] {
  return [
    "You are Claude Code-lite, a local CLI coding assistant.",
    "Use tools when the user asks you to inspect files, edit files, run shell commands, fetch URLs, or delegate to an agent.",
    "Prefer concise Chinese responses for user-facing text.",
    "When a tool is needed, emit tool calls instead of describing what you would do.",
    "After receiving tool results, continue until you can answer the user clearly.",
  ];
}

function getToolDefinitions(): LlmToolDefinition[] {
  return [
    {
      name: "Read",
      description: "Read a text file from the current working directory.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative or absolute file path.",
          },
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
          oldString: {
            type: "string",
            description: "Existing text to replace.",
          },
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
          prompt: {
            type: "string",
            description:
              "Optional guidance describing what to extract from the page.",
          },
        },
        required: ["url", "prompt"],
        additionalProperties: false,
      },
    },
    {
      name: "Agent",
      description: "Launch a simple subagent for delegated work.",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Short task description.",
          },
          prompt: {
            type: "string",
            description: "Prompt to send to the subagent.",
          },
          subagentType: {
            type: "string",
            description: "Optional subagent type or role name.",
          },
        },
        required: ["description", "prompt"],
        additionalProperties: false,
      },
    },
  ];
}

async function* executeToolCall(
  params: QueryParams,
  toolUseMessage: AssistantMessage,
  toolUseBlock: AssistantToolUseBlock,
): AsyncGenerator<Message, void> {
  const tool = findToolByName(getTools(), toolUseBlock.name);
  if (!tool) {
    yield createToolResultMessage(
      toolUseBlock.id,
      stringify({ error: `Unknown tool ${toolUseBlock.name}` }),
      true,
    );
    return;
  }

  let effectiveInput = toolUseBlock.input;
  const permission = await params.canUseTool(
    tool as never,
    effectiveInput as never,
    params.toolUseContext,
    toolUseMessage,
    toolUseBlock.id,
  );

  if (permission.behavior === "deny") {
    yield createToolResultMessage(
      toolUseBlock.id,
      stringify({ error: permission.message }),
      true,
    );
    return;
  }

  if (permission.behavior === "ask") {
    const allowed = await params.onPermissionRequest?.({
      toolName: toolUseBlock.name,
      input: effectiveInput,
      message: permission.message,
    });
    if (!allowed) {
      yield createToolResultMessage(
        toolUseBlock.id,
        stringify({ error: `User rejected ${toolUseBlock.name}` }),
        true,
      );
      return;
    }
    if (permission.updatedInput) {
      effectiveInput = permission.updatedInput;
    }
  } else if (permission.updatedInput) {
    effectiveInput = permission.updatedInput;
  }

  try {
    const result = await tool.call(
      effectiveInput as never,
      params.toolUseContext,
      params.canUseTool,
      toolUseMessage,
    );
    yield createToolResultMessage(toolUseBlock.id, stringify(result.data));
    if (result.extraMessages) {
      for (const extraMessage of result.extraMessages) {
        yield extraMessage;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield createToolResultMessage(
      toolUseBlock.id,
      stringify({ error: message }),
      true,
    );
  }
}

async function* queryWithPlanner(
  params: QueryParams,
): AsyncGenerator<Message, void> {
  const planned = planPrompt(params.prompt);
  if (planned.kind === "text") {
    yield createAssistantTextMessage(planned.text);
    return;
  }

  const introMessage = createAssistantTextMessage(planned.intro);
  yield introMessage;

  const toolUseMessage = createAssistantMessage([
    {
      type: "tool_use",
      id: createId("tool-use"),
      name: planned.toolName,
      input: planned.input,
    },
  ]);
  yield toolUseMessage;
  const toolUseBlock = toolUseMessage.content[0];
  if (toolUseBlock.type !== "tool_use") {
    yield createAssistantTextMessage("内部错误：tool_use block 缺失。");
    return;
  }

  let toolResultMessage: ToolResultMessage | null = null;
  for await (const message of executeToolCall(
    params,
    toolUseMessage,
    toolUseBlock,
  )) {
    toolResultMessage =
      message.type === "tool_result" ? message : toolResultMessage;
    yield message;
  }

  if (!toolResultMessage) {
    yield createAssistantTextMessage(
      `执行 ${planned.toolName} 时没有产生结果。`,
    );
    return;
  }

  if (toolResultMessage.isError) {
    const content = JSON.parse(toolResultMessage.content) as { error?: string };
    yield createAssistantTextMessage(
      planned.summarizeError(content.error ?? "Unknown error"),
    );
    return;
  }

  const result = JSON.parse(toolResultMessage.content) as unknown;
  yield createAssistantTextMessage(planned.summarizeResult(result));
}

async function* queryWithLlm(
  params: QueryParams,
): AsyncGenerator<Message, void> {
  const conversation = [...params.messages];
  const maxTurns = params.maxTurns ?? 8;
  const systemPrompt = [...getDefaultSystemPrompt(), ...params.systemPrompt];

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const llmResponse = await runLlmTurn({
      messages: conversation,
      systemPrompt,
      tools: getToolDefinitions(),
      onTextDelta: params.onAssistantTextDelta,
    });

    if (!llmResponse.text && llmResponse.toolCalls.length === 0) {
      yield createAssistantTextMessage("模型没有返回任何内容。");
      return;
    }

    const assistantBlocks: Array<AssistantTextBlock | AssistantToolUseBlock> =
      [];
    if (llmResponse.text) {
      assistantBlocks.push({
        type: "text",
        text: llmResponse.text,
      });
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
    conversation.push(assistantMessage);
    yield assistantMessage;

    const toolCalls = assistantBlocks.filter(
      (block): block is AssistantToolUseBlock => block.type === "tool_use",
    );
    if (toolCalls.length === 0) {
      return;
    }

    for (const toolCall of toolCalls) {
      for await (const message of executeToolCall(
        params,
        assistantMessage,
        toolCall,
      )) {
        conversation.push(message);
        yield message;
      }
    }
  }

  yield createAssistantTextMessage("达到最大工具轮次限制，已停止继续执行。");
}

export async function* query(
  params: QueryParams,
): AsyncGenerator<Message, void> {
  if (!getLlmConfigFromEnv()) {
    yield* queryWithPlanner(params);
    return;
  }

  try {
    yield* queryWithLlm(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield createAssistantTextMessage(
      `LLM 调用失败，已回退到本地 planner。\n\n${message}`,
    );
    yield* queryWithPlanner(params);
  }
}

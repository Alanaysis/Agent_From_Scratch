import { createId } from "../shared/ids";
import {
  findToolByName,
  type CanUseToolFn,
  type ToolUseContext,
} from "../tools/Tool";
import { getTools } from "../tools/registry";
import { getLlmConfigFromEnv, runLlmTurn, type LlmToolDefinition } from "./llm";
import { detectRelevantSkills } from "../skills/loader";
import type {
  AssistantMessage,
  AssistantTextBlock,
  AssistantToolUseBlock,
  Message,
  ToolResultMessage,
} from "./messages";
import type { ParamConfig } from "../skills/frontmatter";
import { compressMessages, estimateMessageTokens, type Usage, emptyUsage } from "./usage";

// WorkMap types stubbed out (workmap is recipe-specific, gitignored)
type WorkMap = any;

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
  onSpecRequest?: (request: {
    skillId: string;
    params: ParamConfig[];
  }) => Promise<Record<string, any>>;
  onWorkMapUpdate?: (workMap: WorkMap | null) => void;
};

export { executeToolCall, executeWorkMap };

export type PlannedAction =
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

function stringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
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

function planPrompt(prompt: string): PlannedAction {
  const trimmed = prompt.trim();

  const readMatch = trimmed.match(/^read\s+(.+)$/i);
  if (readMatch) {
    const path = readMatch[1].trim();
    return {
      kind: "tool",
      toolName: "Read",
      input: { path },
      intro: `我来读取 ${path} 的内容。`,
      summarizeResult: () => `读取完成：\`${path}\``,
      summarizeError: (message) => `读取 \`${path}\` 失败：${message}`,
    };
  }

  const writeMatch = trimmed.match(/^write\s+(\S+)\s+(.+)$/s);
  if (writeMatch) {
    const path = writeMatch[1].trim();
    const content = writeMatch[2].trimStart();
    return {
      kind: "tool",
      toolName: "Write",
      input: { path, content },
      intro: `我来写入 ${path}。`,
      summarizeResult: () => `写入完成：\`${path}\``,
      summarizeError: (message) => `写入 \`${path}\` 失败：${message}`,
    };
  }

  const editMatch = trimmed.match(/^edit\s+(\S+)\s+(.+?)\s*=>\s*(.+)$/s);
  if (editMatch) {
    const path = editMatch[1].trim();
    const oldString = editMatch[2].trim();
    const newString = editMatch[3].trim();
    return {
      kind: "tool",
      toolName: "Edit",
      input: { path, oldString, newString },
      intro: `我来编辑 ${path} 的内容。`,
      summarizeResult: () => `编辑完成：\`${path}\` 已更新。`,
      summarizeError: (message) => `编辑 \`${path}\` 失败：${message}`,
    };
  }

  const runMatch = trimmed.match(/^run\s+(.+)$/i);
  if (runMatch) {
    const command = runMatch[1].trim();
    return {
      kind: "tool",
      toolName: "Shell",
      input: { command },
      intro: `我来执行 \`${command}\`。`,
      summarizeResult: () => `执行完成：\`${command}\``,
      summarizeError: (message) => `执行 \`${command}\` 失败：${message}`,
    };
  }

  const fetchMatch = trimmed.match(/^fetch\s+(.+?)(?:\s+(.+))?$/i);
  if (fetchMatch) {
    const url = fetchMatch[1].trim();
    const prompt = fetchMatch[2]?.trim() ?? "";
    return {
      kind: "tool",
      toolName: "WebFetch",
      input: { url, prompt },
      intro: `我来获取 ${url} 的内容。`,
      summarizeResult: () => `获取完成：${url}`,
      summarizeError: (message) => `获取 ${url} 失败：${message}`,
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

function replaceParams(input: any, values: Record<string, any>): any {
  if (typeof input === 'string') {
    let result = input;
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result;
  } else if (Array.isArray(input)) {
    return input.map(item => replaceParams(item, values));
  } else if (typeof input === 'object' && input !== null) {
    const result: Record<string, any> = {};
    for (const key of Object.keys(input)) {
      result[key] = replaceParams(input[key], values);
    }
    return result;
  }
  return input;
}

async function* executeWorkMap(
  workMap: WorkMap,
  params: QueryParams,
): AsyncGenerator<Message, void> {
  yield createAssistantTextMessage(
    `🧭 检测到技能 "${workMap.name}"，正在生成工作图...\n\n` +
    `共 ${workMap.phases.length} 个阶段，${workMap.steps.length} 个步骤`,
  );
  
  if (params.onWorkMapUpdate) {
    params.onWorkMapUpdate(workMap);
  }
  
  // 收集参数值
  let collectedValues: Record<string, any> = {};
  if (workMap.globalParams && workMap.globalParams.length > 0) {
    if (params.onSpecRequest) {
      collectedValues = await params.onSpecRequest({
        skillId: workMap.skillName,
        params: workMap.globalParams,
      });
      workMap.globalParamValues = collectedValues;
    }
  }
  
  let completedCount = 0;
  for (const phase of workMap.phases) {
    for (const stepId of phase.stepIds) {
      const step = workMap.steps.find(s => s.id === stepId);
      if (!step) continue;
      
      step.status = 'running';
      if (params.onWorkMapUpdate) {
        params.onWorkMapUpdate(workMap);
      }
      
      yield createAssistantTextMessage(
        `[${phase.name}] 执行: ${step.name}`,
      );
      
      try {
        if (step.toolName) {
          // 替换参数值到工具输入
          let toolInput = step.toolInputTemplate || {};
          if (Object.keys(collectedValues).length > 0) {
            toolInput = replaceParams(toolInput, collectedValues);
          }
          
          const toolUseBlock: AssistantToolUseBlock = {
            type: 'tool_use',
            id: createId('tool-use'),
            name: step.toolName,
            input: toolInput,
          };
          const toolUseMessage = createAssistantMessage([toolUseBlock]);
          yield toolUseMessage;
          
          for await (const message of executeToolCall(params, toolUseMessage, toolUseBlock)) {
            yield message;
          }
        }
        
        step.status = 'completed';
        completedCount++;
        
      } catch (error) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : String(error);
        yield createAssistantTextMessage(
          `⚠️ 步骤 "${step.name}" 执行失败: ${step.error}`,
        );
        if (params.onWorkMapUpdate) {
          params.onWorkMapUpdate(workMap);
        }
        break;
      }
      
      if (params.onWorkMapUpdate) {
        params.onWorkMapUpdate(workMap);
      }
    }
  }
  
  yield createAssistantTextMessage(
    `\n🎉 WorkMap "${workMap.name}" 执行完成！\n\n` +
    `✅ 共完成 ${completedCount} 个步骤`,
  );
}

export async function* query(
  params: QueryParams,
): AsyncGenerator<Message, void> {
  const relevantSkills = detectRelevantSkills(params.prompt);
  
  if (relevantSkills.length > 0) {
    const skill = relevantSkills[0];
    
    try {
      // WorkMap/recipe-specific code is gitignored - stubbed out
      // const workMap = parseSkillToWorkMap(skill);
      const workMap: any = { steps: [] };
      if (workMap.steps.length > 0) {
        yield* executeWorkMap(workMap, params);
        return;
      }
    } catch (e) {
      console.error('[WorkMap] Parse failed, falling back', e);
    }
    
    let enhancedSystemPrompt = [...getDefaultSystemPrompt(), ...params.systemPrompt];
    enhancedSystemPrompt.push(
      `\n\n=== RELEVANT SKILL: ${skill.name} ===\n${skill.content}\n\n` +
      `INSTRUCTIONS: Follow the step-by-step workflow outlined in the skill above.` +
      `Make sure to complete ALL steps in order, including: property, alignsetting, all mark points, etc.` +
      `Do not skip any steps! Execute the full workflow automatically without asking for confirmation.`,
    );
    
    const enhancedParams = {
      ...params,
      systemPrompt: enhancedSystemPrompt,
    };
    
    if (!getLlmConfigFromEnv()) {
      yield* queryWithPlanner(enhancedParams);
      return;
    }
  
    try {
      yield* queryWithLlm(enhancedParams);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield createAssistantTextMessage(
        `LLM 调用失败，已回退到本地 planner。\n\n${message}`,
      );
      yield* queryWithPlanner(enhancedParams);
    }
    
    return;
  }
  
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

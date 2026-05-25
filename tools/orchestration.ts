import type { AssistantMessage, Message } from "../runtime/messages";
import type { CanUseToolFn, ToolUseContext, Tool } from "./Tool";
import { findToolByName, type Tools } from "./Tool";
import { getTools } from "./registry";
import { createId } from "../shared/ids";

export type ToolUseBlock = {
  id: string;
  name: string;
  input: unknown;
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

type ToolCallResult = {
  toolUseBlock: ToolUseBlock;
  messages: Message[];
};

async function executeSingleToolCall(
  toolUseBlock: ToolUseBlock,
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
  tools: Tools,
): Promise<ToolCallResult> {
  const messages: Message[] = [];
  const tool = findToolByName(tools, toolUseBlock.name);

  if (!tool) {
    messages.push(
      createToolResultMessage(
        toolUseBlock.id,
        stringify({ error: `Unknown tool ${toolUseBlock.name}` }),
        true,
      ),
    );
    return { toolUseBlock, messages };
  }

  const parentMessage = createAssistantMessage([
    { type: "tool_use", id: toolUseBlock.id, name: toolUseBlock.name, input: toolUseBlock.input },
  ]);

  const permission = await canUseTool(tool, toolUseBlock.input, toolUseContext, parentMessage, toolUseBlock.id);

  if (permission.behavior === "deny") {
    messages.push(
      createToolResultMessage(
        toolUseBlock.id,
        stringify({ error: permission.message }),
        true,
      ),
    );
    return { toolUseBlock, messages };
  }

  let effectiveInput = toolUseBlock.input;
  if (permission.updatedInput !== undefined) {
    effectiveInput = permission.updatedInput;
  }

  try {
    const result = await tool.call(
      effectiveInput as never,
      toolUseContext,
      canUseTool,
      parentMessage,
    );
    messages.push(createToolResultMessage(toolUseBlock.id, stringify(result.data)));
    if (result.extraMessages) {
      for (const extraMessage of result.extraMessages) {
        messages.push(extraMessage);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    messages.push(
      createToolResultMessage(toolUseBlock.id, stringify({ error: errorMsg }), true),
    );
  }

  return { toolUseBlock, messages };
}

export async function* runTools(
  toolUses: ToolUseBlock[],
  _assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<Message, void> {
  const tools = getTools();

  for (const toolUse of toolUses) {
    const result = await executeSingleToolCall(toolUse, canUseTool, toolUseContext, tools);
    for (const msg of result.messages) {
      yield msg;
    }
  }
}

export async function* runToolsConcurrently(
  toolUses: ToolUseBlock[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
  maxConcurrency: number = 3,
): AsyncGenerator<Message, void> {
  const tools = getTools();

  const concurrentSafe: ToolUseBlock[] = [];
  const sequential: ToolUseBlock[] = [];

  for (const tu of toolUses) {
    const tool = findToolByName(tools, tu.name);
    if (tool?.isConcurrencySafe(tu.input) ?? false) {
      concurrentSafe.push(tu);
    } else {
      sequential.push(tu);
    }
  }

  if (concurrentSafe.length > 0) {
    const batches: ToolUseBlock[][] = [];
    for (let i = 0; i < concurrentSafe.length; i += maxConcurrency) {
      batches.push(concurrentSafe.slice(i, i + maxConcurrency));
    }

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map((tu) => executeSingleToolCall(tu, canUseTool, toolUseContext, tools)),
      );
      for (const result of results) {
        for (const msg of result.messages) {
          yield msg;
        }
      }
    }
  }

  for (const tu of sequential) {
    const result = await executeSingleToolCall(tu, canUseTool, toolUseContext, tools);
    for (const msg of result.messages) {
      yield msg;
    }
  }
}

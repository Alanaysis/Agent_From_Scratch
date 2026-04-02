import type { Message } from "./messages";

export type LlmProviderName = "openai" | "anthropic";

export type LlmToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type LlmTurnResponse = {
  text: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: unknown;
  }>;
};

export type LlmConfig = {
  provider: LlmProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt?: string;
  anthropicVersion?: string;
};

type LlmTurnParams = {
  messages: Message[];
  systemPrompt: string[];
  tools: LlmToolDefinition[];
  onTextDelta?: (text: string) => void;
};

type OpenAiToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type OpenAiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
};

type OpenAiContent = string | Array<{ type?: string; text?: string }>;

type OpenAiResponse = {
  choices?: Array<{
    message?: {
      content?: OpenAiContent;
      tool_calls?: OpenAiToolCall[];
    };
  }>;
  error?: {
    message?: string;
  };
};

type AnthropicUserBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

type AnthropicAssistantBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: AnthropicUserBlock[] | AnthropicAssistantBlock[];
};

type AnthropicResponse = {
  content?: AnthropicAssistantBlock[];
  error?: {
    message?: string;
  };
};

type AnthropicSseEvent = {
  type: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
  };
  content_block?: {
    type?: string;
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
  };
  error?: {
    message?: string;
  };
};

type LlmProvider = {
  runTurn(params: LlmTurnParams, config: LlmConfig): Promise<LlmTurnResponse>;
};

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getDefaultBaseUrl(provider: LlmProviderName): string {
  return provider === "anthropic"
    ? "https://api.anthropic.com/v1"
    : "https://api.openai.com/v1";
}

export function getLlmConfigFromEnv(): LlmConfig | null {
  const apiKey = process.env.CCL_LLM_API_KEY?.trim();
  const model = process.env.CCL_LLM_MODEL?.trim();
  if (!apiKey || !model) {
    return null;
  }

  const provider =
    process.env.CCL_LLM_PROVIDER?.trim().toLowerCase() === "anthropic"
      ? "anthropic"
      : "openai";

  return {
    provider,
    apiKey,
    model,
    baseUrl: stripTrailingSlash(
      process.env.CCL_LLM_BASE_URL?.trim() || getDefaultBaseUrl(provider),
    ),
    systemPrompt: process.env.CCL_LLM_SYSTEM_PROMPT?.trim(),
    anthropicVersion: process.env.CCL_ANTHROPIC_VERSION?.trim() || "2023-06-01",
  };
}

function extractOpenAiText(content: OpenAiContent | undefined): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function parseToolArguments(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { raw };
  }
}

function toOpenAiMessages(
  messages: Message[],
  systemPrompt: string[],
  config: LlmConfig,
): OpenAiMessage[] {
  const apiMessages: OpenAiMessage[] = [];
  const allSystem = [...systemPrompt];
  if (config.systemPrompt) {
    allSystem.push(config.systemPrompt);
  }
  if (allSystem.length > 0) {
    apiMessages.push({
      role: "system",
      content: allSystem.join("\n\n"),
    });
  }

  for (const message of messages) {
    if (message.type === "user") {
      apiMessages.push({ role: "user", content: message.content });
      continue;
    }

    if (message.type === "tool_result") {
      apiMessages.push({
        role: "tool",
        tool_call_id: message.toolUseId,
        content: message.content,
      });
      continue;
    }

    const textBlocks = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text);
    const toolBlocks = message.content.filter(
      (block) => block.type === "tool_use",
    );
    apiMessages.push({
      role: "assistant",
      content: textBlocks.length > 0 ? textBlocks.join("\n\n") : null,
      tool_calls:
        toolBlocks.length > 0
          ? toolBlocks.map((block) => ({
              id: block.id,
              type: "function",
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input ?? {}),
              },
            }))
          : undefined,
    });
  }

  return apiMessages;
}

function toAnthropicMessages(messages: Message[]): AnthropicMessage[] {
  const apiMessages: AnthropicMessage[] = [];

  for (const message of messages) {
    if (message.type === "user") {
      apiMessages.push({
        role: "user",
        content: [{ type: "text", text: message.content }],
      });
      continue;
    }

    if (message.type === "tool_result") {
      apiMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.toolUseId,
            content: message.content,
            is_error: message.isError,
          },
        ],
      });
      continue;
    }

    apiMessages.push({
      role: "assistant",
      content: message.content.map((block) =>
        block.type === "text"
          ? { type: "text", text: block.text }
          : {
              type: "tool_use",
              id: block.id,
              name: block.name,
              input: block.input,
            },
      ),
    });
  }

  return apiMessages;
}

async function readSseEvents(
  response: Response,
  onEvent: (event: string | null, data: string) => void,
): Promise<void> {
  if (!response.body) {
    throw new Error("Streaming response body is missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      let eventName: string | null = null;
      for (const line of frame.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        if (trimmed.startsWith("event:")) {
          eventName = trimmed.slice(6).trim();
          continue;
        }
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") {
          continue;
        }
        onEvent(eventName, data);
      }
    }
  }
}

const openAiProvider: LlmProvider = {
  async runTurn(params, config) {
    const toolCallsByIndex = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();
    let accumulatedText = "";

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        stream: true,
        messages: toOpenAiMessages(
          params.messages,
          params.systemPrompt,
          config,
        ),
        tools: params.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as OpenAiResponse;
      throw new Error(
        payload.error?.message ||
          `LLM request failed with status ${response.status}`,
      );
    }

    await readSseEvents(response, (_event, data) => {
      const payload = JSON.parse(data) as {
        choices?: Array<{
          delta?: {
            content?: string;
            tool_calls?: Array<{
              index: number;
              id?: string;
              function?: {
                name?: string;
                arguments?: string;
              };
            }>;
          };
        }>;
      };

      const delta = payload.choices?.[0]?.delta;
      if (!delta) {
        return;
      }

      if (typeof delta.content === "string" && delta.content.length > 0) {
        accumulatedText += delta.content;
        params.onTextDelta?.(accumulatedText);
      }

      for (const partial of delta.tool_calls ?? []) {
        const existing = toolCallsByIndex.get(partial.index) ?? {
          id: "",
          name: "",
          arguments: "",
        };
        if (partial.id) {
          existing.id = partial.id;
        }
        if (partial.function?.name) {
          existing.name = partial.function.name;
        }
        if (partial.function?.arguments) {
          existing.arguments += partial.function.arguments;
        }
        toolCallsByIndex.set(partial.index, existing);
      }
    });

    return {
      text: accumulatedText.trim(),
      toolCalls: [...toolCallsByIndex.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, toolCall]) => ({
          id: toolCall.id,
          name: toolCall.name,
          input: parseToolArguments(toolCall.arguments),
        })),
    };
  },
};

const anthropicProvider: LlmProvider = {
  async runTurn(params, config) {
    const systemParts = [...params.systemPrompt];
    if (config.systemPrompt) {
      systemParts.push(config.systemPrompt);
    }

    const response = await fetch(`${config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": config.anthropicVersion || "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 2048,
        stream: true,
        system: systemParts.join("\n\n"),
        messages: toAnthropicMessages(params.messages),
        tools: params.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        })),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as AnthropicResponse;
      throw new Error(
        payload.error?.message ||
          `LLM request failed with status ${response.status}`,
      );
    }

    let accumulatedText = "";
    const toolCallsByIndex = new Map<
      number,
      { id: string; name: string; inputJson: string; input?: unknown }
    >();

    await readSseEvents(response, (event, data) => {
      if (event === "error") {
        const payload = JSON.parse(data) as AnthropicSseEvent;
        throw new Error(payload.error?.message || "Anthropic streaming error");
      }

      const payload = JSON.parse(data) as AnthropicSseEvent;
      if (event === "content_block_start" && payload.content_block) {
        if (payload.content_block.type === "tool_use") {
          toolCallsByIndex.set(payload.index ?? 0, {
            id: payload.content_block.id ?? "",
            name: payload.content_block.name ?? "",
            inputJson: payload.content_block.input
              ? JSON.stringify(payload.content_block.input)
              : "",
            input: payload.content_block.input,
          });
          return;
        }
        if (
          payload.content_block.type === "text" &&
          typeof payload.content_block.text === "string" &&
          payload.content_block.text.length > 0
        ) {
          accumulatedText += payload.content_block.text;
          params.onTextDelta?.(accumulatedText);
        }
        return;
      }

      if (event === "content_block_delta" && payload.delta) {
        if (
          payload.delta.type === "text_delta" &&
          typeof payload.delta.text === "string"
        ) {
          accumulatedText += payload.delta.text;
          params.onTextDelta?.(accumulatedText);
          return;
        }

        if (
          payload.delta.type === "input_json_delta" &&
          typeof payload.delta.partial_json === "string"
        ) {
          const existing = toolCallsByIndex.get(payload.index ?? 0) ?? {
            id: "",
            name: "",
            inputJson: "",
          };
          existing.inputJson += payload.delta.partial_json;
          toolCallsByIndex.set(payload.index ?? 0, existing);
        }
      }
    });

    return {
      text: accumulatedText.trim(),
      toolCalls: [...toolCallsByIndex.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, toolCall]) => ({
          id: toolCall.id,
          name: toolCall.name,
          input:
            toolCall.input !== undefined
              ? toolCall.input
              : parseToolArguments(toolCall.inputJson),
        })),
    };
  },
};

function getProvider(config: LlmConfig): LlmProvider {
  return config.provider === "anthropic" ? anthropicProvider : openAiProvider;
}

export async function runLlmTurn(
  params: LlmTurnParams,
): Promise<LlmTurnResponse> {
  const config = getLlmConfigFromEnv();
  if (!config) {
    throw new Error("LLM is not configured");
  }
  return getProvider(config).runTurn(params, config);
}

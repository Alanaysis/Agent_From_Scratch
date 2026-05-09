function stripTrailingSlash(value) {
    return value.endsWith("/") ? value.slice(0, -1) : value;
}
function getDefaultBaseUrl(provider) {
    return provider === "anthropic"
        ? "https://api.anthropic.com/v1"
        : "https://api.openai.com/v1";
}
export function getLlmConfigFromEnv() {
    const apiKey = process.env.CCL_LLM_API_KEY?.trim();
    const model = process.env.CCL_LLM_MODEL?.trim();
    if (!apiKey || !model) {
        return null;
    }
    const provider = process.env.CCL_LLM_PROVIDER?.trim().toLowerCase() === "anthropic"
        ? "anthropic"
        : "openai";
    return {
        provider,
        apiKey,
        model,
        baseUrl: stripTrailingSlash(process.env.CCL_LLM_BASE_URL?.trim() || getDefaultBaseUrl(provider)),
        systemPrompt: process.env.CCL_LLM_SYSTEM_PROMPT?.trim(),
        anthropicVersion: process.env.CCL_ANTHROPIC_VERSION?.trim() || "2023-06-01",
    };
}
export function extractOpenAiText(content) {
    if (typeof content === "string") {
        return content;
    }
    // Handle single object with text property
    if (typeof content === "object" &&
        content !== null &&
        "text" in content &&
        typeof content.text === "string") {
        return content.text;
    }
    if (Array.isArray(content)) {
        return content
            .map((part) => {
            if (typeof part === "undefined") {
                return "";
            }
            if (typeof part === "object" &&
                part !== null &&
                "text" in part &&
                typeof part.text === "string") {
                return part.text;
            }
            return "";
        })
            .filter(Boolean)
            .join("\n");
    }
    return "";
}
export function parseToolArguments(raw) {
    // Handle non-string types by checking if it's already a primitive or object
    if (raw === null || raw === undefined) {
        return {};
    }
    // If it's not a string, check the type
    const rawType = typeof raw;
    if (rawType !== "string") {
        // For non-string types, convert to JSON and parse
        try {
            return JSON.parse(String(raw));
        }
        catch {
            return {};
        }
    }
    try {
        return raw ? JSON.parse(raw) : {};
    }
    catch {
        return { raw };
    }
}
export function toOpenAiMessages(messages, systemPrompt, config) {
    const apiMessages = [];
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
        const toolBlocks = message.content.filter((block) => block.type === "tool_use");
        apiMessages.push({
            role: "assistant",
            content: textBlocks.length > 0 ? textBlocks.join("\n\n") : null,
            tool_calls: toolBlocks.length > 0
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
function toAnthropicMessages(messages) {
    const apiMessages = [];
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
            content: message.content.map((block) => block.type === "text"
                ? { type: "text", text: block.text }
                : {
                    type: "tool_use",
                    id: block.id,
                    name: block.name,
                    input: block.input,
                }),
        });
    }
    return apiMessages;
}
async function readSseEvents(response, onEvent) {
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
            let eventName = null;
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
const openAiProvider = {
    async runTurn(params, config) {
        const toolCallsByIndex = new Map();
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
                messages: toOpenAiMessages(params.messages, params.systemPrompt, config),
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
            const payload = (await response.json());
            throw new Error(payload.error?.message ||
                `LLM request failed with status ${response.status}`);
        }
        await readSseEvents(response, (_event, data) => {
            const payload = JSON.parse(data);
            const delta = payload.choices?.[0]?.delta;
            if (!delta) {
                return;
            }
            if (delta.content !== undefined && delta.content !== null) {
                const textContent = extractOpenAiText(delta.content);
                if (textContent.length > 0) {
                    accumulatedText += textContent;
                    params.onTextDelta?.(accumulatedText);
                }
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
const anthropicProvider = {
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
            const payload = (await response.json());
            throw new Error(payload.error?.message ||
                `LLM request failed with status ${response.status}`);
        }
        let accumulatedText = "";
        const toolCallsByIndex = new Map();
        await readSseEvents(response, (event, data) => {
            if (event === "error") {
                const payload = JSON.parse(data);
                throw new Error(payload.error?.message || "Anthropic streaming error");
            }
            const payload = JSON.parse(data);
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
                if (payload.content_block.type === "text" &&
                    typeof payload.content_block.text === "string" &&
                    payload.content_block.text.length > 0) {
                    accumulatedText += payload.content_block.text;
                    params.onTextDelta?.(accumulatedText);
                }
                return;
            }
            if (event === "content_block_delta" && payload.delta) {
                if (payload.delta.type === "text_delta" &&
                    typeof payload.delta.text === "string") {
                    accumulatedText += payload.delta.text;
                    params.onTextDelta?.(accumulatedText);
                    return;
                }
                if (payload.delta.type === "input_json_delta" &&
                    typeof payload.delta.partial_json === "string") {
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
                input: toolCall.input !== undefined
                    ? toolCall.input
                    : parseToolArguments(toolCall.inputJson),
            })),
        };
    },
};
function getProvider(config) {
    return config.provider === "anthropic" ? anthropicProvider : openAiProvider;
}
export async function runLlmTurn(params) {
    const config = getLlmConfigFromEnv();
    if (!config) {
        throw new Error("LLM is not configured");
    }
    return getProvider(config).runTurn(params, config);
}

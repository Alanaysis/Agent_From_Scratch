import { createId } from "../../shared/ids";
import { getLlmConfigFromEnv, runLlmTurn } from "../../runtime/llm";
import { createSubagentContext } from "./subagentContext";
import { getAgentDefinition, getToolDefinitionsForAgent } from "./agentRegistry";
import { compressSubagentResult } from "./resultCompressor";
import { findToolByName } from "../Tool";
import { getTools } from "../registry";
import { canUseTool } from "../../permissions/engine";
function buildSubagentSystemPrompt(agentDef) {
    return [
        ...agentDef.systemPrompt,
        "IMPORTANT: You are a sub-agent. You cannot launch other sub-agents. Complete your task independently.",
        "When you finish, provide a concise summary of your findings or actions as your final message.",
    ];
}
function getFilteredTools(agentDef) {
    const allTools = getTools();
    const blockedTools = ["Agent", "Team", "Reflect", "Skill"];
    if (agentDef.allowedTools === "*") {
        return allTools.filter((t) => !blockedTools.includes(t.name));
    }
    return allTools.filter((t) => agentDef.allowedTools.includes(t.name) && !blockedTools.includes(t.name));
}
function getSubagentToolDefinitions(agentDef) {
    const allDefs = buildAllToolDefinitions();
    return getToolDefinitionsForAgent(agentDef, allDefs);
}
function buildAllToolDefinitions() {
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
    ];
}
function createAssistantMessage(blocks) {
    return {
        id: createId("assistant"),
        type: "assistant",
        content: blocks,
    };
}
function createToolResultMessage(toolUseId, content, isError = false) {
    return {
        id: createId("tool-result"),
        type: "tool_result",
        toolUseId,
        content,
        isError,
    };
}
function stringify(data) {
    try {
        return JSON.stringify(data, null, 2);
    }
    catch {
        return String(data);
    }
}
async function* executeSubagentToolCall(toolName, toolInput, toolUseId, context, permissionFn, filteredTools) {
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
        const result = await tool.call(effectiveInput, context, permissionFn, parentMessage);
        yield createToolResultMessage(toolUseId, stringify(result.data));
        if (result.extraMessages) {
            for (const extraMessage of result.extraMessages) {
                yield extraMessage;
            }
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        yield createToolResultMessage(toolUseId, stringify({ error: message }), true);
    }
}
export async function runAgent(params) {
    const agentDef = getAgentDefinition(params.subagentType);
    const maxTurns = params.maxTurns ?? agentDef.maxTurns ?? 8;
    const permissionFn = params.canUseTool ?? canUseTool;
    const subContext = createSubagentContext(params.parentContext, {
        agentType: agentDef.name,
    });
    const filteredTools = getFilteredTools(agentDef);
    if (!getLlmConfigFromEnv()) {
        return [
            `Subagent "${agentDef.name}" accepted the task.`,
            `Description: ${params.description}`,
            `Prompt length: ${params.prompt.length} characters`,
            "No LLM configured — subagent cannot execute without a model.",
        ].join("\n");
    }
    const messages = [
        { id: createId("user"), type: "user", content: params.prompt },
    ];
    const systemPrompt = buildSubagentSystemPrompt(agentDef);
    const toolDefs = getSubagentToolDefinitions(agentDef);
    const allResultMessages = [];
    for (let turn = 0; turn < maxTurns; turn += 1) {
        const llmResponse = await runLlmTurn({
            messages,
            systemPrompt,
            tools: toolDefs,
            onTextDelta: params.onProgress,
        });
        if (!llmResponse.text && llmResponse.toolCalls.length === 0) {
            break;
        }
        const assistantBlocks = [];
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
        const toolCalls = assistantBlocks.filter((block) => block.type === "tool_use");
        if (toolCalls.length === 0) {
            break;
        }
        for (const toolCall of toolCalls) {
            for await (const msg of executeSubagentToolCall(toolCall.name, toolCall.input, toolCall.id, subContext, permissionFn, filteredTools)) {
                messages.push(msg);
                allResultMessages.push(msg);
            }
        }
    }
    return compressSubagentResult(allResultMessages);
}

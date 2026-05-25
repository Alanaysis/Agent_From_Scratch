import { findToolByName } from "./Tool";
import { getTools } from "./registry";
import { createId } from "../shared/ids";
function stringify(data) {
    try {
        return JSON.stringify(data, null, 2);
    }
    catch {
        return String(data);
    }
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
function createAssistantMessage(blocks) {
    return {
        id: createId("assistant"),
        type: "assistant",
        content: blocks,
    };
}
async function executeSingleToolCall(toolUseBlock, canUseTool, toolUseContext, tools) {
    const messages = [];
    const tool = findToolByName(tools, toolUseBlock.name);
    if (!tool) {
        messages.push(createToolResultMessage(toolUseBlock.id, stringify({ error: `Unknown tool ${toolUseBlock.name}` }), true));
        return { toolUseBlock, messages };
    }
    const parentMessage = createAssistantMessage([
        { type: "tool_use", id: toolUseBlock.id, name: toolUseBlock.name, input: toolUseBlock.input },
    ]);
    const permission = await canUseTool(tool, toolUseBlock.input, toolUseContext, parentMessage, toolUseBlock.id);
    if (permission.behavior === "deny") {
        messages.push(createToolResultMessage(toolUseBlock.id, stringify({ error: permission.message }), true));
        return { toolUseBlock, messages };
    }
    let effectiveInput = toolUseBlock.input;
    if (permission.updatedInput !== undefined) {
        effectiveInput = permission.updatedInput;
    }
    try {
        const result = await tool.call(effectiveInput, toolUseContext, canUseTool, parentMessage);
        messages.push(createToolResultMessage(toolUseBlock.id, stringify(result.data)));
        if (result.extraMessages) {
            for (const extraMessage of result.extraMessages) {
                messages.push(extraMessage);
            }
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        messages.push(createToolResultMessage(toolUseBlock.id, stringify({ error: errorMsg }), true));
    }
    return { toolUseBlock, messages };
}
export async function* runTools(toolUses, _assistantMessages, canUseTool, toolUseContext) {
    const tools = getTools();
    for (const toolUse of toolUses) {
        const result = await executeSingleToolCall(toolUse, canUseTool, toolUseContext, tools);
        for (const msg of result.messages) {
            yield msg;
        }
    }
}
export async function* runToolsConcurrently(toolUses, canUseTool, toolUseContext, maxConcurrency = 3) {
    const tools = getTools();
    const concurrentSafe = [];
    const sequential = [];
    for (const tu of toolUses) {
        const tool = findToolByName(tools, tu.name);
        if (tool?.isConcurrencySafe(tu.input) ?? false) {
            concurrentSafe.push(tu);
        }
        else {
            sequential.push(tu);
        }
    }
    if (concurrentSafe.length > 0) {
        const batches = [];
        for (let i = 0; i < concurrentSafe.length; i += maxConcurrency) {
            batches.push(concurrentSafe.slice(i, i + maxConcurrency));
        }
        for (const batch of batches) {
            const results = await Promise.all(batch.map((tu) => executeSingleToolCall(tu, canUseTool, toolUseContext, tools)));
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

import { createId } from "../../shared/ids";
import { getLlmConfig, runLlmTurn } from "../../runtime/llm";
import { createSubagentContext } from "./subagentContext";
import { compressSubagentResult } from "./resultCompressor";
import { findToolByName } from "../Tool";
import { getTools } from "../registry";
import { canUseTool } from "../../permissions/engine";
import { BUILTIN_TEAMS, getTeamDefinition, getToolDefsForTeamMember, } from "./team";
function buildMemberSystemPrompt(member, task) {
    return [
        ...member.systemPrompt,
        "IMPORTANT: You are a team member. You cannot launch other sub-agents.",
        "Focus on your specific role and expertise.",
        "When you finish, provide a clear summary of your findings or actions.",
        `The overall task is: ${task}`,
    ];
}
function getFilteredToolsForMember(member) {
    const allTools = getTools();
    const blockedTools = ["Agent", "Team", "Reflect", "Skill"];
    if (member.allowedTools === "*") {
        return allTools.filter((t) => !blockedTools.includes(t.name));
    }
    return allTools.filter((t) => member.allowedTools.includes(t.name) && !blockedTools.includes(t.name));
}
function buildAllToolDefinitions() {
    return [
        {
            name: "Read",
            description: "Read a text file from the current working directory.",
            parameters: {
                type: "object",
                properties: { path: { type: "string", description: "File path." } },
                required: ["path"],
                additionalProperties: false,
            },
        },
        {
            name: "Write",
            description: "Write text content to a file.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "File path." },
                    content: { type: "string", description: "File content." },
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
                    path: { type: "string", description: "File path." },
                    oldString: { type: "string", description: "Text to replace." },
                    newString: { type: "string", description: "Replacement text." },
                },
                required: ["path", "oldString", "newString"],
                additionalProperties: false,
            },
        },
        {
            name: "Shell",
            description: "Run a shell command.",
            parameters: {
                type: "object",
                properties: { command: { type: "string", description: "Shell command." } },
                required: ["command"],
                additionalProperties: false,
            },
        },
        {
            name: "WebFetch",
            description: "Fetch a URL and return processed text.",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL." },
                    prompt: { type: "string", description: "What to extract." },
                },
                required: ["url", "prompt"],
                additionalProperties: false,
            },
        },
        {
            name: "WebSearch",
            description: "Search the web.",
            parameters: {
                type: "object",
                properties: { query: { type: "string", description: "Search query." } },
                required: ["query"],
                additionalProperties: false,
            },
        },
        {
            name: "FileTree",
            description: "List directory tree.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Directory path." },
                    maxDepth: { type: "number", description: "Max depth." },
                },
                required: ["path"],
                additionalProperties: false,
            },
        },
        {
            name: "SearchFiles",
            description: "Search files by name or content.",
            parameters: {
                type: "object",
                properties: {
                    mode: { type: "string", enum: ["files", "content"] },
                    pattern: { type: "string", description: "Pattern." },
                    path: { type: "string", description: "Directory." },
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
async function* executeMemberToolCall(toolName, toolInput, toolUseId, context, permissionFn, filteredTools) {
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
async function runMemberAgent(member, task, parentContext, permissionFn, maxTurns, onProgress) {
    const subContext = createSubagentContext(parentContext, {
        agentType: member.name,
    });
    const filteredTools = getFilteredToolsForMember(member);
    const systemPrompt = buildMemberSystemPrompt(member, task);
    const allToolDefs = buildAllToolDefinitions();
    const toolDefs = getToolDefsForTeamMember(member, allToolDefs);
    const messages = [
        { id: createId("user"), type: "user", content: task },
    ];
    const allResultMessages = [];
    onProgress?.({
        member: member.name,
        phase: "started",
        message: `${member.name} starting task...`,
    });
    for (let turn = 0; turn < maxTurns; turn += 1) {
        const llmResponse = await runLlmTurn({
            messages,
            systemPrompt,
            tools: toolDefs,
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
            for await (const msg of executeMemberToolCall(toolCall.name, toolCall.input, toolCall.id, subContext, permissionFn, filteredTools)) {
                messages.push(msg);
                allResultMessages.push(msg);
            }
        }
    }
    onProgress?.({
        member: member.name,
        phase: "completed",
        message: `${member.name} completed task.`,
    });
    return compressSubagentResult(allResultMessages);
}
export async function runTeam(params) {
    const { teamName, task, parentContext } = params;
    const permissionFn = params.canUseTool ?? canUseTool;
    const maxTurnsPerMember = params.maxTurnsPerMember ?? 6;
    if (!getLlmConfig()?.apiKey) {
        return {
            summary: `Team "${teamName}" cannot run without LLM configuration.`,
            taskResults: {},
            messages: [],
        };
    }
    const teamDef = getTeamDefinition(teamName);
    if (!teamDef) {
        return {
            summary: `Team "${teamName}" not found. Available teams: ${Object.keys(BUILTIN_TEAMS).join(", ")}`,
            taskResults: {},
            messages: [],
        };
    }
    const taskResults = {};
    const teamMessages = [];
    const now = () => Date.now();
    params.onProgress?.({
        member: teamDef.lead.name,
        phase: "team_started",
        message: `Team "${teamDef.name}" starting task: ${task}`,
    });
    const memberResults = await Promise.all(teamDef.members.map(async (member) => {
        const memberTask = `[Team: ${teamDef.name}] ${task}\n\nYour role: ${member.role} (${member.description})`;
        const result = await runMemberAgent(member, memberTask, parentContext, permissionFn, maxTurnsPerMember, params.onProgress);
        taskResults[member.name] = result;
        teamMessages.push({
            from: member.name,
            to: teamDef.lead.name,
            type: "task_result",
            content: result,
            timestamp: now(),
        });
        return { member, result };
    }));
    const memberSummaries = memberResults
        .map(({ member, result }) => `## ${member.name} (${member.role})\n${result}`)
        .join("\n\n");
    const leadTask = [
        `[Team: ${teamDef.name}] Synthesize the following team findings into a coherent report.`,
        "",
        `Original task: ${task}`,
        "",
        "## Team Member Reports",
        memberSummaries,
        "",
        "Please provide a unified summary with key findings, prioritized by importance.",
    ].join("\n");
    const leadResult = await runMemberAgent(teamDef.lead, leadTask, parentContext, permissionFn, maxTurnsPerMember, params.onProgress);
    taskResults[teamDef.lead.name] = leadResult;
    teamMessages.push({
        from: teamDef.lead.name,
        to: "all",
        type: "status_update",
        content: leadResult,
        timestamp: now(),
    });
    params.onProgress?.({
        member: teamDef.lead.name,
        phase: "team_completed",
        message: `Team "${teamDef.name}" completed task.`,
    });
    return {
        summary: leadResult,
        taskResults,
        messages: teamMessages,
    };
}

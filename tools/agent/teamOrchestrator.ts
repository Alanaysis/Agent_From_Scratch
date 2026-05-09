import { createId } from "../../shared/ids";
import type { Message, AssistantMessage } from "../../runtime/messages";
import { getLlmConfigFromEnv, runLlmTurn, type LlmToolDefinition } from "../../runtime/llm";
import { createSubagentContext } from "./subagentContext";
import { compressSubagentResult } from "./resultCompressor";
import { findToolByName, type CanUseToolFn, type ToolUseContext, type Tools } from "../Tool";
import { getTools } from "../registry";
import { canUseTool } from "../../permissions/engine";
import {
  BUILTIN_TEAMS,
  type TeamDefinition,
  type TeamMemberDefinition,
  type TeamTaskItem,
  type TeamMessage,
  getTeamDefinition,
  getToolDefsForTeamMember,
} from "./team";

export type TeamRunParams = {
  teamName: string;
  task: string;
  parentContext: ToolUseContext;
  canUseTool?: CanUseToolFn;
  maxTurnsPerMember?: number;
  onProgress?: (info: { member: string; phase: string; message: string }) => void;
};

export type TeamRunResult = {
  summary: string;
  taskResults: Record<string, string>;
  messages: TeamMessage[];
};

function buildMemberSystemPrompt(member: TeamMemberDefinition, task: string): string[] {
  return [
    ...member.systemPrompt,
    "IMPORTANT: You are a team member. You cannot launch other sub-agents.",
    "Focus on your specific role and expertise.",
    "When you finish, provide a clear summary of your findings or actions.",
    `The overall task is: ${task}`,
  ];
}

function getFilteredToolsForMember(member: TeamMemberDefinition): Tools {
  const allTools = getTools();
  const blockedTools = ["Agent", "Team", "Reflect", "Skill"];
  if (member.allowedTools === "*") {
    return allTools.filter((t) => !blockedTools.includes(t.name));
  }
  return allTools.filter(
    (t) => member.allowedTools.includes(t.name) && !blockedTools.includes(t.name),
  );
}

function buildAllToolDefinitions(): LlmToolDefinition[] {
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

function createAssistantMessage(
  blocks: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }>,
): AssistantMessage {
  return {
    id: createId("assistant"),
    type: "assistant",
    content: blocks as AssistantMessage["content"],
  };
}

function createToolResultMessage(toolUseId: string, content: string, isError = false): Message {
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

async function* executeMemberToolCall(
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
    const result = await tool.call(effectiveInput as never, context, permissionFn, parentMessage);
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

async function runMemberAgent(
  member: TeamMemberDefinition,
  task: string,
  parentContext: ToolUseContext,
  permissionFn: CanUseToolFn,
  maxTurns: number,
  onProgress?: (info: { member: string; phase: string; message: string }) => void,
): Promise<string> {
  const subContext = createSubagentContext(parentContext, {
    agentType: member.name,
  });

  const filteredTools = getFilteredToolsForMember(member);
  const systemPrompt = buildMemberSystemPrompt(member, task);
  const allToolDefs = buildAllToolDefinitions();
  const toolDefs = getToolDefsForTeamMember(member, allToolDefs);

  const messages: Message[] = [
    { id: createId("user"), type: "user", content: task } as Message,
  ];

  const allResultMessages: Message[] = [];

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

    const toolCalls = assistantBlocks.filter(
      (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use",
    );

    if (toolCalls.length === 0) {
      break;
    }

    for (const toolCall of toolCalls) {
      for await (const msg of executeMemberToolCall(
        toolCall.name,
        toolCall.input,
        toolCall.id,
        subContext,
        permissionFn,
        filteredTools,
      )) {
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

export async function runTeam(params: TeamRunParams): Promise<TeamRunResult> {
  const { teamName, task, parentContext } = params;
  const permissionFn = params.canUseTool ?? canUseTool;
  const maxTurnsPerMember = params.maxTurnsPerMember ?? 6;

  if (!getLlmConfigFromEnv()) {
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

  const taskResults: Record<string, string> = {};
  const teamMessages: TeamMessage[] = [];
  const now = () => Date.now();

  params.onProgress?.({
    member: teamDef.lead.name,
    phase: "team_started",
    message: `Team "${teamDef.name}" starting task: ${task}`,
  });

  const memberResults = await Promise.all(
    teamDef.members.map(async (member) => {
      const memberTask = `[Team: ${teamDef.name}] ${task}\n\nYour role: ${member.role} (${member.description})`;
      const result = await runMemberAgent(
        member,
        memberTask,
        parentContext,
        permissionFn,
        maxTurnsPerMember,
        params.onProgress,
      );
      taskResults[member.name] = result;
      teamMessages.push({
        from: member.name,
        to: teamDef.lead.name,
        type: "task_result",
        content: result,
        timestamp: now(),
      });
      return { member, result };
    }),
  );

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

  const leadResult = await runMemberAgent(
    teamDef.lead,
    leadTask,
    parentContext,
    permissionFn,
    maxTurnsPerMember,
    params.onProgress,
  );

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

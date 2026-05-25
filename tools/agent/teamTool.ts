import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { runTeam, type TeamRunResult } from "./teamOrchestrator";

export type TeamInput = {
  teamName: string;
  task: string;
};

export type TeamOutput = {
  status: "completed" | "error";
  summary: string;
  memberResults: Record<string, string>;
};

export const TeamTool: Tool<TeamInput, TeamOutput> = {
  name: "Team",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Launch a team of specialized agents that work in parallel on a complex task";
  },
  async call(
    args: TeamInput,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<TeamOutput>> {
    const result: TeamRunResult = await runTeam({
      teamName: args.teamName,
      task: args.task,
      parentContext: context,
      canUseTool,
    });

    const hasError = result.summary.includes("cannot run") || result.summary.includes("not found");

    return {
      data: {
        status: hasError ? "error" : "completed",
        summary: result.summary,
        memberResults: result.taskResults,
      },
    };
  },
  async validateInput(input) {
    if (!input.teamName?.trim()) {
      return { result: false, message: "Team name is required" };
    }
    if (!input.task?.trim()) {
      return { result: false, message: "Task description is required" };
    }
    return { result: true };
  },
  async checkPermissions(input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Team launch requires confirmation for team "${input.teamName}"`,
      };
    }
    return {
      behavior: "allow",
      updatedInput: input,
    };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return false;
  },
};

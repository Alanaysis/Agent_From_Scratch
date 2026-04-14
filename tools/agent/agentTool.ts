import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { runAgent } from "./runAgent";
import { createSubagentContext } from "./subagentContext";

export type AgentInput = {
  description: string;
  prompt: string;
  subagentType?: string;
};

export type AgentOutput = {
  status: "completed";
  result: string;
};

export const AgentTool: Tool<AgentInput, AgentOutput> = {
  name: "Agent",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Launch a subagent";
  },
  async call(
    args: AgentInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<AgentOutput>> {
    createSubagentContext(context, {
      agentType: args.subagentType,
    });
    const result = await runAgent({
      description: args.description,
      prompt: args.prompt,
      subagentType: args.subagentType,
    });
    return {
      data: {
        status: "completed",
        result,
      },
    };
  },
  async validateInput(input) {
    if (!input.description.trim()) {
      return { result: false, message: "Description is required" };
    }
    if (!input.prompt.trim()) {
      return { result: false, message: "Prompt is required" };
    }
    return { result: true };
  },
  async checkPermissions(input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Agent launch requires confirmation for "${input.description}"`,
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

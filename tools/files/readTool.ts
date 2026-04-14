import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { readTextFile, resolvePathFromCwd } from "../../shared/fs";

export type ReadInput = {
  path: string;
};

export type ReadOutput = {
  content: string;
};

export const ReadTool: Tool<ReadInput, ReadOutput> = {
  name: "Read",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Read a file";
  },
  async call(
    args: ReadInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<ReadOutput>> {
    const absolutePath = resolvePathFromCwd(context.cwd, args.path);
    const content = await readTextFile(absolutePath);
    return {
      data: {
        content,
      },
    };
  },
  async validateInput(input) {
    if (!input?.path || typeof input.path !== 'string' || !input.path.trim()) {
      return { result: false, message: "Path is required" };
    }
    return { result: true };
  },
  async checkPermissions(input) {
    return {
      behavior: "allow",
      updatedInput: input,
    };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  },
};

import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { resolvePathFromCwd, writeTextFile } from "../../shared/fs";

export type WriteInput = {
  path: string;
  content: string;
};

export type WriteOutput = {
  bytesWritten: number;
};

export const WriteTool: Tool<WriteInput, WriteOutput> = {
  name: "Write",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Write a file";
  },
  async call(
    args: WriteInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<WriteOutput>> {
    const absolutePath = resolvePathFromCwd(context.cwd, args.path);
    const bytesWritten = await writeTextFile(absolutePath, args.content);
    return {
      data: {
        bytesWritten,
      },
    };
  },
  async validateInput(input) {
    if (!input?.path || typeof input.path !== 'string' || !input.path.trim()) {
      return { result: false, message: "Path is required" };
    }
    if (typeof input.content !== 'string') {
      return { result: false, message: "Content must be a string" };
    }
    return { result: true };
  },
  async checkPermissions(input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Write requires confirmation for ${input.path}`,
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
  isConcurrencySafe(): boolean {
    return true;
  },
};

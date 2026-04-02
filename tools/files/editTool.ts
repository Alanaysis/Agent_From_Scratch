import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import {
  readTextFile,
  resolvePathFromCwd,
  writeTextFile,
} from "../../shared/fs";

export type EditInput = {
  path: string;
  oldString: string;
  newString: string;
};

export type EditOutput = {
  applied: boolean;
};

export const EditTool: Tool<EditInput, EditOutput> = {
  name: "Edit",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Edit a file in place";
  },
  async call(
    args: EditInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<EditOutput>> {
    const absolutePath = resolvePathFromCwd(context.cwd, args.path);
    const content = await readTextFile(absolutePath);
    if (!content.includes(args.oldString)) {
      throw new Error(`Could not find target string in ${args.path}`);
    }
    const updated = content.replace(args.oldString, args.newString);
    await writeTextFile(absolutePath, updated);
    return {
      data: {
        applied: true,
      },
    };
  },
  async validateInput(input) {
    if (!input.path.trim()) {
      return { result: false, message: "Path is required" };
    }
    if (input.oldString === input.newString) {
      return { result: false, message: "oldString and newString must differ" };
    }
    return { result: true };
  },
  async checkPermissions(input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Edit requires confirmation for ${input.path}`,
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

import type { CanUseToolFn, Tool, ToolResult, ToolUseContext } from "../Tool";
import { spawn } from "child_process";
import type { AssistantMessage } from "../../runtime/messages";

export type ShellInput = {
  command: string;
};

export type ShellOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export const ShellTool: Tool<ShellInput, ShellOutput> = {
  name: "Shell",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Run a shell command";
  },
  async call(
    args: ShellInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<ShellOutput>> {
    const data = await new Promise<ShellOutput>((resolve, reject) => {
      const child = spawn(args.command, {
        cwd: context.cwd,
        shell: true,
        signal: context.abortController.signal,
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      });
    });

    return {
      data,
    };
  },
  async validateInput(input) {
    if (!input.command.trim()) {
      return { result: false, message: "Command is required" };
    }
    return { result: true };
  },
  async checkPermissions(input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Shell requires confirmation for "${input.command}"`,
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

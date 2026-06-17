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

/** Commands that are safe to run without confirmation */
const SAFE_COMMANDS = [
  'ls', 'pwd', 'whoami', 'date', 'echo', 'cat', 'head', 'tail', 'wc',
  'grep', 'find', 'which', 'env', 'printenv', 'uname', 'hostname',
  'git', 'npm', 'node', 'npx', 'bun', 'pnpm', 'yarn',
  'python', 'python3', 'pip', 'pip3',
  'tsc', 'eslint', 'prettier',
  'curl', 'wget',
  'mkdir', 'touch', 'cp',
  'ps', 'top', 'df', 'du', 'free',
];

/** Dangerous patterns that should always require confirmation */
const DANGEROUS_PATTERNS = [
  /\brm\b/, /\bkill\b/, /\bpkill\b/, /\bshutdown\b/, /\breboot\b/,
  /\bchmod\b/, /\bchown\b/, /\bsudo\b/, /\bsu\b/,
  /\bmkfs\b/, /\bdd\b/, /\bformat\b/,
  /\b>\s*\/\w/, /\b>>\s*\/\w/,  // Redirect to system paths
  /\|\s*sh/, /\|\s*bash/,  // Pipe to shell
  /\bcurl\b.*\|\s*(sh|bash|python)/,  // curl pipe to interpreter
];

function isWhitelistedCommand(command: string): boolean {
  const trimmed = command.trim();
  // Check if it starts with a safe command
  const firstWord = trimmed.split(/\s+/)[0];
  if (!firstWord || !SAFE_COMMANDS.includes(firstWord)) return false;
  // Check for dangerous patterns anywhere in the command
  return !DANGEROUS_PATTERNS.some(p => p.test(trimmed));
}

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
    if (!input?.command || !String(input.command).trim()) {
      return { result: false, message: "Command is required" };
    }
    return { result: true };
  },
  async checkPermissions(input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      // Whitelisted safe commands can run without confirmation
      if (isWhitelistedCommand(input.command)) {
        return { behavior: "allow", updatedInput: input };
      }
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

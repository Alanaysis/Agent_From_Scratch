import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import {
  readTextFile,
  resolvePathFromCwd,
  writeTextFile,
} from "../../shared/fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export type EditInput = {
  path: string;
  oldString: string;
  newString: string;
};

export type EditOutput = {
  applied: boolean;
  diff: string;
  backupPath?: string;
};

function generateUnifiedDiff(
  oldLines: string[],
  newLines: string[],
  filename: string,
): string {
  let diff = `--- a/${filename}\n+++ b/${filename}\n`;

  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length);
  let hunkStart = -1;
  let hunkOld = 0;
  let hunkNew = 0;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] ?? "";
    const newLine = newLines[i] ?? "";
    const isContext = oldLine === newLine;

    if (isContext) {
      if (hunkStart >= 0) {
        // Close hunk
        diff += `@@ -${hunkOld},${hunkNew} +${hunkNew},${hunkNew} @@\n`;
        hunkStart = -1;
      }
      diff += ` ${oldLine}\n`;
    } else {
      if (hunkStart < 0) {
        hunkStart = i;
        hunkOld = Math.max(1, i);
        hunkNew = Math.max(1, i);
      }
    }
  }

  if (hunkStart >= 0) {
    diff += `@@ -${hunkOld},1 +${hunkNew},1 @@\n`;
  }

  return diff;
}

export const EditTool: Tool<EditInput, EditOutput> = {
  name: "Edit",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Edit a file in place with diff display and automatic backup.";
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

    // Generate unified diff
    const oldLines = content.split("\n");
    const newContent = content.replace(args.oldString, args.newString);
    const newLines = newContent.split("\n");
    const diff = generateUnifiedDiff(oldLines, newLines, args.path);

    // Create backup before writing
    const backupDir = join(context.cwd, ".claude-code-lite", "backups");
    const backupPath = join(backupDir, `${args.path.replace(/[/]/g, "_")}_${Date.now()}.bak`);
    await mkdir(backupDir, { recursive: true });
    await writeFile(backupPath, content, "utf8");

    await writeTextFile(absolutePath, newContent);
    return {
      data: {
        applied: true,
        diff,
        backupPath,
      },
    };
  },
  async validateInput(input) {
    if (!input?.path || typeof input.path !== 'string' || !input.path.trim()) {
      return { result: false, message: "Path is required" };
    }
    if (typeof input.oldString !== 'string') {
      return { result: false, message: "oldString must be a string" };
    }
    if (typeof input.newString !== 'string') {
      return { result: false, message: "newString must be a string" };
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
  isConcurrencySafe(): boolean {
    return true;
  },
};

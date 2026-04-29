import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { readdir, stat, readFile } from "fs/promises";
import { resolve, relative, dirname } from "path";

export type SearchFilesInput = {
  glob?: string;
  pattern?: string;
  path?: string;
  limit?: number;
  type?: "files" | "content";
};

export type FileMatch = {
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
};

export type ContentMatch = {
  path: string;
  line: number;
  content: string;
};

export type SearchFilesOutput = {
  matches: (FileMatch | ContentMatch)[];
  totalFiles: number;
  totalMatches: number;
  truncated: boolean;
  searchPath: string;
};

function getFileType(mode: number): "file" | "directory" | "symlink" {
  if (mode & 0o120000) return "symlink";
  if (mode & 0o40000) return "directory";
  return "file";
}

function matchesGlob(filename: string, glob: string): boolean {
  // Simple glob matching: *, **, ?
  const pattern = glob
    .replace(/\*\*/g, "___DOUBLESTAR___")
    .replace(/\*/g, "___SINGLESTAR___")
    .replace(/\?/g, "___QUESTION___");

  let regex = "^";
  for (const part of pattern.split("___DOUBLESTAR___")) {
    for (const sub of part.split("___SINGLESTAR___")) {
      regex += sub
        .replace(/[/]/g, "[/]")
        .replace(/___QUESTION___/g, ".");
    }
    regex += ".*";
  }
  regex += "$";

  try {
    return new RegExp(regex).test(filename);
  } catch {
    return false;
  }
}

async function searchFilesInDir(
  dirPath: string,
  cwd: string,
  glob: string | null,
  pattern: string | null,
  limit: number,
  counter: { files: number; contentMatches: number; total: number },
  type: "files" | "content",
): Promise<(FileMatch | ContentMatch)[]> {
  const results: (FileMatch | ContentMatch)[] = [];

  let entries: { name: string; mode: number }[] = [];
  try {
    const rawEntries = await readdir(dirPath, { withFileTypes: true });
    for (const re of rawEntries) {
      if (re.name.startsWith(".")) continue;
      const st = await stat(resolve(dirPath, re.name)).catch(() => null);
      if (!st) continue;
      entries.push({ name: re.name, mode: st.mode });
    }
  } catch {
    return results;
  }

  for (const e of entries) {
    if (counter.total >= limit) break;

    const fullPath = resolve(dirPath, e.name);
    const relPath = relative(cwd, fullPath);
    const fileType = getFileType(e.mode);

    // If glob is specified, check if the file matches
    if (glob) {
      const fileName = e.name;
      const dirName = dirname(relPath);
      const fullRelPath = dirName ? `${dirName}/${fileName}` : fileName;

      // Check both filename and full relative path against glob
      const nameMatches = matchesGlob(fileName, glob);
      const pathMatches = glob.includes("/") ? matchesGlob(fullRelPath, glob) : false;

      if (!nameMatches && !pathMatches) continue;
    }

    if (fileType === "directory") {
      // Recurse into subdirectories
      const subResults = await searchFilesInDir(
        fullPath,
        cwd,
        glob,
        pattern,
        limit,
        counter,
        type,
      );
      results.push(...subResults);
    } else {
      counter.files++;
      counter.total++;

      if (type === "files") {
        results.push({
          path: relPath,
          type: "file",
          size: e.mode & 0o77777,
        });
      } else if (type === "content" && pattern) {
        // Search file content for pattern
        try {
          const content = await readFile(fullPath, "utf8");
          const lines = content.split("\n");
          const regex = new RegExp(pattern, "i");

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push({
                path: relPath,
                line: i + 1,
                content: lines[i].trim(),
              });
              counter.contentMatches++;
              counter.total++;
              if (counter.total >= limit) break;
            }
          }
        } catch {
          // Skip files we can't read
        }
      }
    }
  }

  return results;
}

export const SearchFilesTool: Tool<SearchFilesInput, SearchFilesOutput> = {
  name: "SearchFiles",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Search for files by glob pattern or search file contents by regex. Supports 'files' mode (list matching files) and 'content' mode (find matching lines).";
  },
  async call(
    args: SearchFilesInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<SearchFilesOutput>> {
    const searchPath = args.path
      ? resolve(context.cwd, args.path)
      : context.cwd;
    const limit = args.limit ?? 50;
    const type = args.type ?? "files";

    const results = await searchFilesInDir(
      searchPath,
      context.cwd,
      args.glob || null,
      args.pattern || null,
      limit,
      { files: 0, contentMatches: 0, total: 0 },
      type,
    );

    const truncated = results.length >= limit;

    return {
      data: {
        matches: results.slice(0, limit),
        totalFiles: 0,
        totalMatches: results.length,
        truncated,
        searchPath: relative(context.cwd, searchPath),
      },
    };
  },
  async validateInput(input) {
    if (input.glob !== undefined && typeof input.glob !== "string") {
      return { result: false, message: "glob must be a string" };
    }
    if (input.pattern !== undefined && typeof input.pattern !== "string") {
      return { result: false, message: "pattern must be a string" };
    }
    if (input.path !== undefined && typeof input.path !== "string") {
      return { result: false, message: "path must be a string" };
    }
    if (input.limit !== undefined && (input.limit < 1 || !Number.isInteger(input.limit))) {
      return { result: false, message: "limit must be a positive integer" };
    }
    if (input.type !== undefined && !["files", "content"].includes(input.type)) {
      return { result: false, message: "type must be 'files' or 'content'" };
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

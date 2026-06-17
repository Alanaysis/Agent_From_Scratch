import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve, normalize } from "path";

export type FileStateCache = Map<string, string>;

export function createFileStateCache(): FileStateCache {
  return new Map();
}

/**
 * @deprecated Use resolvePathSafe instead — it includes path traversal protection.
 * This function will be removed in a future version.
 */
export function resolvePathFromCwd(cwd: string, inputPath: string): string {
  return resolve(cwd, inputPath);
}

/**
 * Resolve a path and verify it falls within allowed roots.
 * Prevents path traversal attacks (e.g., ../../etc/passwd).
 *
 * @param inputPath - The user/LLM-provided path
 * @param cwd - Current working directory
 * @param allowedRoots - Array of allowed root directories (default: [cwd])
 * @returns Resolved absolute path
 * @throws Error if path is outside allowed roots
 */
export function resolvePathSafe(
  inputPath: string,
  cwd: string,
  allowedRoots?: string[],
): string {
  const roots = allowedRoots ?? [cwd];
  const resolved = normalize(resolve(cwd, inputPath));

  const isAllowed = roots.some((root) => {
    const normalizedRoot = normalize(resolve(cwd, root));
    return resolved === normalizedRoot || resolved.startsWith(normalizedRoot + "/");
  });

  if (!isAllowed) {
    throw new Error(
      `Path outside allowed scope: ${resolved}\nAllowed roots: ${roots.join(", ")}`,
    );
  }

  return resolved;
}

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function writeTextFile(
  path: string,
  content: string,
): Promise<number> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return Buffer.byteLength(content, "utf8");
}

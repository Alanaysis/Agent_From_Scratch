import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve } from "path";

export type FileStateCache = Map<string, string>;

export function createFileStateCache(): FileStateCache {
  return new Map();
}

export function resolvePathFromCwd(cwd: string, inputPath: string): string {
  return resolve(cwd, inputPath);
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

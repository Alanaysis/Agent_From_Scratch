import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
export function createFileStateCache() {
    return new Map();
}
export function resolvePathFromCwd(cwd, inputPath) {
    return resolve(cwd, inputPath);
}
export async function readTextFile(path) {
    return readFile(path, "utf8");
}
export async function writeTextFile(path, content) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
    return Buffer.byteLength(content, "utf8");
}

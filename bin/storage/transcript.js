import { appendFile, mkdir, rm } from "fs/promises";
import { join } from "path";
export function getTranscriptPath(cwd, sessionId) {
    return join(cwd, ".claude-code-lite", "transcripts", `${sessionId}.jsonl`);
}
export async function appendTranscript(cwd, sessionId, messages) {
    const filePath = getTranscriptPath(cwd, sessionId);
    await mkdir(join(cwd, ".claude-code-lite", "transcripts"), {
        recursive: true,
    });
    const lines = messages.map((message) => JSON.stringify(message)).join("\n");
    await appendFile(filePath, `${lines}\n`, "utf8");
}
export async function readTranscriptMessages(cwd, sessionId) {
    const { readFile } = await import("fs/promises");
    const filePath = getTranscriptPath(cwd, sessionId);
    const content = await readFile(filePath, "utf8");
    return content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}
export async function deleteTranscript(cwd, sessionId) {
    await rm(getTranscriptPath(cwd, sessionId), { force: true });
}

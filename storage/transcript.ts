import { appendFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import type { Message } from "../runtime/messages";

export function getTranscriptPath(cwd: string, sessionId: string): string {
  return join(cwd, ".claude-code-lite", "transcripts", `${sessionId}.jsonl`);
}

export async function appendTranscript(
  cwd: string,
  sessionId: string,
  messages: Message[],
): Promise<void> {
  const filePath = getTranscriptPath(cwd, sessionId);
  await mkdir(join(cwd, ".claude-code-lite", "transcripts"), {
    recursive: true,
  });
  const lines = messages.map((message) => JSON.stringify(message)).join("\n");
  await appendFile(filePath, `${lines}\n`, "utf8");
}

export async function readTranscriptMessages(
  cwd: string,
  sessionId: string,
): Promise<Message[]> {
  const { readFile } = await import("fs/promises");
  const filePath = getTranscriptPath(cwd, sessionId);
  const content = await readFile(filePath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Message);
}

export async function deleteTranscript(
  cwd: string,
  sessionId: string,
): Promise<void> {
  await rm(getTranscriptPath(cwd, sessionId), { force: true });
}

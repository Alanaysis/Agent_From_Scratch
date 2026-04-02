import type { Message } from "./messages";
import { appendTranscript, getTranscriptPath } from "../storage/transcript";
import { updateSessionInfo } from "../storage/sessionIndex";
import { emptyUsage, type Usage } from "./usage";

export type SessionConfig = {
  id: string;
  cwd: string;
};

export class SessionEngine {
  private messages: Message[] = [];
  private usage: Usage = emptyUsage();

  constructor(private readonly config: SessionConfig) {}

  get sessionId(): string {
    return this.config.id;
  }

  get cwd(): string {
    return this.config.cwd;
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  appendMessage(message: Message): void {
    this.messages.push(message);
  }

  hydrateMessages(messages: Message[]): void {
    this.messages = [...messages];
  }

  async recordMessages(messages: Message[]): Promise<void> {
    this.messages.push(...messages);
    await appendTranscript(this.cwd, this.sessionId, messages);
    await updateSessionInfo(this.cwd, this.sessionId, this.messages);
  }

  getTranscriptPath(): string {
    return getTranscriptPath(this.cwd, this.sessionId);
  }

  getUsage(): Usage {
    return { ...this.usage };
  }
}

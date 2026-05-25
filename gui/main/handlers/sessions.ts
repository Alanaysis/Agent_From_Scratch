import { ipcMain } from "electron";
import { cwd } from "process";
import { listSessions, readSessionInfo } from "../../../storage/sessionIndex";
import type { SessionInfo } from "../../../storage/sessionIndex";
import { readTranscriptMessages as readSessionMessages, getTranscriptPath } from "../../../storage/transcript";
import { log } from "../logger";

interface SessionListResult {
  sessions: SessionInfo[];
}

interface SessionGetResult {
  session: SessionInfo;
  messages: unknown[];
}

interface SessionMessagesResult {
  messages: unknown[];
  transcriptPath: string;
}

export function registerSessionHandlers() {
  log('INFO', 'Sessions', 'Registering session handlers')

  ipcMain.handle("sessions:list", async (): Promise<SessionListResult> => {
    log('INFO', 'Sessions', 'sessions:list called')
    try {
      const sessions = await listSessions(cwd());
      log('INFO', 'Sessions', `sessions:list returned ${sessions.length} sessions`)
      return { sessions };
    } catch (e) {
      log('ERROR', 'Sessions', 'sessions:list failed', e)
      throw e
    }
  });

  ipcMain.handle("sessions:get", async (_event, sessionId: string): Promise<SessionGetResult | null> => {
    log('INFO', 'Sessions', `sessions:get called for ${sessionId}`)
    try {
      const session = await readSessionInfo(cwd(), sessionId);
      if (!session) {
        log('INFO', 'Sessions', `sessions:get ${sessionId} not found`)
        return null;
      }
      const messages = await readSessionMessages(cwd(), sessionId);
      log('INFO', 'Sessions', `sessions:get ${sessionId} returned ${messages.length} messages`)
      return { session, messages };
    } catch (e) {
      log('ERROR', 'Sessions', `sessions:get ${sessionId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("sessions:messages", async (_event, sessionId: string): Promise<SessionMessagesResult | null> => {
    log('INFO', 'Sessions', `sessions:messages called for ${sessionId}`)
    try {
      const session = await readSessionInfo(cwd(), sessionId);
      if (!session) return null;
      const messages = await readSessionMessages(cwd(), sessionId);
      const transcriptPath = getTranscriptPath(cwd(), sessionId);
      log('INFO', 'Sessions', `sessions:messages ${sessionId} returned ${messages.length} messages`)
      return { messages, transcriptPath };
    } catch (e) {
      log('ERROR', 'Sessions', `sessions:messages ${sessionId} failed`, e)
      throw e
    }
  });
}
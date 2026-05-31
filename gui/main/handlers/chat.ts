import { ipcMain, BrowserWindow } from "electron";
import { cwd } from "process";
import { createId } from "../../../shared/ids";
import { createInitialAppState } from "../../../runtime/state";
import { SessionEngine } from "../../../runtime/session";
import { canUseTool } from "../../../permissions/engine";
import { findToolByName } from "../../../tools/Tool";
import { getTools } from "../../../tools/registry";
import { query } from "../../../runtime/query";
import { readTranscriptMessages, getTranscriptPath } from "../../../storage/transcript";
import { setCheckpointResponse } from "../../../tools/workflow/checkpointTool";
import type { Message } from "../../../runtime/messages";
import { log } from "../logger";

interface ChatSendInput {
  message: string;
  sessionId?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool_result" | "tool_error";
  content: string;
  timestamp: number;
  toolName?: string;
  toolUseId?: string;
}

interface ChatSendResult {
  messages: ChatMessage[];
  sessionId: string;
  transcriptPath: string;
}

function messageToChatMessage(msg: Message): ChatMessage {
  return {
    id: msg.id,
    role: msg.type === "user" ? "user" : 
          msg.type === "tool_result" ? (msg.isError ? "tool_error" : "tool_result") : 
          "assistant",
    content: typeof msg.content === "string" ? msg.content : 
      msg.content.map(b => b.type === "text" ? b.text : `[${b.name}]`).join("\n"),
    timestamp: Date.now(),
    toolName: msg.type === "assistant" && msg.content[0]?.type === "tool_use" ? msg.content[0].name : undefined,
    toolUseId: msg.type === "assistant" && msg.content[0]?.type === "tool_use" ? msg.content[0].id : undefined,
  };
}

let pendingPermissionResolve: ((response: any) => void) | null = null
let activeAbortController: AbortController | null = null
type PermissionQueueItem = {
  request: { toolName: string; input: unknown; message: string; requestType?: string; options?: string[]; schema?: any[] }
  resolve: (response: any) => void
}
const permissionQueue: PermissionQueueItem[] = []
let processingPermissions = false

function processNextPermission(window: Electron.BrowserWindow | null) {
  if (processingPermissions || permissionQueue.length === 0) return
  processingPermissions = true
  const next = permissionQueue.shift()!
  window?.webContents.send("chat:permission", {
    toolName: next.request.toolName,
    input: next.request.input,
    message: next.request.message,
    requestType: next.request.requestType || 'permission',
    options: next.request.options,
    schema: next.request.schema,
  })
  pendingPermissionResolve = (response: any) => {
    next.resolve(response)
    pendingPermissionResolve = null
    processingPermissions = false
    processNextPermission(window)
  }
  setTimeout(() => {
    if (pendingPermissionResolve === next.resolve) {
      next.resolve({ approved: false, timedOut: true })
      pendingPermissionResolve = null
      processingPermissions = false
      processNextPermission(window)
    }
  }, 120000) // Extended timeout for workflow checkpoints
}

export function registerChatHandlers() {
  log('INFO', 'Chat', 'Registering chat handlers')

  ipcMain.handle("chat:permission-response", async (_event, response: { approved: boolean; choice?: string; data?: Record<string, unknown> }) => {
    log('INFO', 'Chat', `chat:permission-response:`, response)
    if (pendingPermissionResolve) {
      pendingPermissionResolve(response)
    }
  })

  ipcMain.handle("chat:cancel", async () => {
    log('INFO', 'Chat', 'chat:cancel called')
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
  })

  ipcMain.handle("chat:send", async (event, input: ChatSendInput): Promise<ChatSendResult> => {
    log('INFO', 'Chat', `chat:send called with message: "${input.message.substring(0, 50)}..."`)

    try {
      // Clear any queued permissions from previous requests
      permissionQueue.length = 0
      processingPermissions = false
      pendingPermissionResolve = null
      const window = BrowserWindow.fromWebContents(event.sender);
      const autoApprove = false;
      
      let session: SessionEngine;
      if (input.sessionId) {
        session = new SessionEngine({
          id: input.sessionId,
          cwd: cwd(),
        });
        session.hydrateMessages(await readTranscriptMessages(cwd(), input.sessionId));
      } else {
        session = new SessionEngine({
          id: createId("session"),
          cwd: cwd(),
        });
      }

      const appStateRef = { current: createInitialAppState() };
      const abortController = new AbortController();
      activeAbortController = abortController;
      
      const userMessage: Message = {
        id: createId("user"),
        type: "user",
        content: input.message,
      };
      await session.recordMessages([userMessage]);

      let lastAssistantText = "";

      const producedMessages: Message[] = [];
      for await (const message of query({
        prompt: input.message,
        messages: session.getMessages(),
        systemPrompt: [],
        sessionId: session.sessionId,
        toolUseContext: {
          cwd: cwd(),
          abortController,
          messages: session.getMessages(),
          getAppState: () => appStateRef.current,
          setAppState: (updater) => {
            appStateRef.current = updater(appStateRef.current);
          },
        },
        canUseTool,
        onAssistantTextDelta: (text) => {
          lastAssistantText = text;
          window?.webContents.send("chat:delta", { text, sessionId: session.sessionId });
        },
        onPermissionRequest: async (request) => {
          if (autoApprove) return true;
          const tool = findToolByName(getTools(), request.toolName);
          if (!tool) return false;

          // Determine request type based on tool name
          let requestType = 'permission'
          let options: string[] | undefined
          let schema: any[] | undefined
          let checkpointId: string | undefined

          if (request.toolName === 'Checkpoint') {
            const input = request.input as any
            requestType = input?.type || 'approval'
            options = input?.options
            schema = input?.schema
            checkpointId = createId("cp")
          }

          return new Promise<boolean>((resolve) => {
            permissionQueue.push({
              request: { ...request, requestType, options, schema },
              resolve: (response: any) => {
                const resp = typeof response === 'boolean' ? { approved: response } : response

                // For checkpoint tools, store the full response so the tool can read it
                if (request.toolName === 'Checkpoint' && checkpointId) {
                  setCheckpointResponse(checkpointId, {
                    approved: resp.approved !== false,
                    choice: resp.choice,
                    data: resp.data,
                    timedOut: resp.timedOut,
                  })
                  // Inject checkpointId into the tool input so call() can read the response
                  const input = request.input as any
                  if (input) input.__checkpointId = checkpointId
                }

                resolve(resp.approved !== false)
              },
            })
            processNextPermission(window)
          })
        },
      })) {
        producedMessages.push(message);
      }

      if (producedMessages.length > 0) {
        await session.recordMessages(producedMessages);
      }

      const seenIds = new Set<string>()
      const uniqueMessages: Message[] = []
      for (const msg of session.getMessages()) {
        if (!seenIds.has(msg.id)) {
          seenIds.add(msg.id)
          uniqueMessages.push(msg)
        }
      }

      activeAbortController = null;
      const finalMessages: ChatMessage[] = uniqueMessages.map(messageToChatMessage);
      log('INFO', 'Chat', `chat:send completed with ${finalMessages.length} messages`)
      return {
        messages: finalMessages,
        sessionId: session.sessionId,
        transcriptPath: getTranscriptPath(cwd(), session.sessionId),
      };
    } catch (e) {
      log('ERROR', 'Chat', 'chat:send failed', e)
      throw e
    }
  });
}
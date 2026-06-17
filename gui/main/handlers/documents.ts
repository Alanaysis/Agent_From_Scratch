import { ipcMain } from "electron";
import { cwd } from "process";
import {
  readDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
  listDocumentsByProposal,
  type StoredDocument,
  type DocumentType,
} from "../../../storage/documentIndex";
import { addDocRef, removeDocRef, isDocInjected } from "../../../storage/irgMd";
import { createId } from "../../../shared/ids";
import { log } from "../logger";

interface DocumentCreateInput {
  title: string;
  type: DocumentType;
  content?: string;
  proposalId?: string;
  createdBy?: string;
}

interface DocumentUpdateInput {
  docId: string;
  title?: string;
  type?: DocumentType;
  content?: string;
}

export function registerDocumentHandlers() {
  log('INFO', 'Documents', 'Registering document handlers')

  ipcMain.handle("documents:list", async (): Promise<{ documents: StoredDocument[] }> => {
    log('INFO', 'Documents', 'documents:list called')
    try {
      const documents = await listDocuments(cwd());
      return { documents };
    } catch (e) {
      log('ERROR', 'Documents', 'documents:list failed', e)
      throw e
    }
  });

  ipcMain.handle("documents:get", async (_event, docId: string): Promise<{ document: StoredDocument | null }> => {
    log('INFO', 'Documents', `documents:get called for ${docId}`)
    try {
      const document = await readDocument(cwd(), docId);
      return { document };
    } catch (e) {
      log('ERROR', 'Documents', `documents:get ${docId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("documents:create", async (_event, input: DocumentCreateInput): Promise<{ document: StoredDocument }> => {
    log('INFO', 'Documents', `documents:create called: ${input.title}`)
    try {
      const document = await createDocument(cwd(), {
        id: createId("doc"),
        title: input.title,
        type: input.type,
        content: input.content || "",
        proposalId: input.proposalId,
        createdBy: input.createdBy,
      });
      return { document };
    } catch (e) {
      log('ERROR', 'Documents', 'documents:create failed', e)
      throw e
    }
  });

  ipcMain.handle("documents:update", async (_event, input: DocumentUpdateInput): Promise<{ document: StoredDocument | null }> => {
    log('INFO', 'Documents', `documents:update called for ${input.docId}`)
    try {
      const document = await updateDocument(cwd(), input.docId, {
        title: input.title,
        type: input.type,
        content: input.content,
      });
      return { document };
    } catch (e) {
      log('ERROR', 'Documents', `documents:update ${input.docId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("documents:delete", async (_event, docId: string): Promise<void> => {
    log('INFO', 'Documents', `documents:delete called for ${docId}`)
    try {
      await deleteDocument(cwd(), docId);
    } catch (e) {
      log('ERROR', 'Documents', `documents:delete ${docId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("documents:list_by_proposal", async (_event, proposalId: string): Promise<{ documents: StoredDocument[] }> => {
    log('INFO', 'Documents', `documents:list_by_proposal called for ${proposalId}`)
    try {
      const documents = await listDocumentsByProposal(cwd(), proposalId);
      return { documents };
    } catch (e) {
      log('ERROR', 'Documents', `documents:list_by_proposal failed`, e)
      throw e
    }
  });

  ipcMain.handle("documents:is_injected", async (_event, docId: string): Promise<{ injected: boolean }> => {
    log('INFO', 'Documents', `documents:is_injected called for ${docId}`)
    try {
      const injected = await isDocInjected(cwd(), docId);
      return { injected };
    } catch (e) {
      log('ERROR', 'Documents', `documents:is_injected ${docId} failed`, e)
      return { injected: false }
    }
  });

  ipcMain.handle("documents:toggle_inject", async (_event, input: { docId: string; inject: boolean }): Promise<{ ok: boolean }> => {
    log('INFO', 'Documents', `documents:toggle_inject called for ${input.docId}, inject=${input.inject}`)
    try {
      if (input.inject) {
        await addDocRef(cwd(), input.docId);
      } else {
        await removeDocRef(cwd(), input.docId);
      }
      return { ok: true };
    } catch (e) {
      log('ERROR', 'Documents', `documents:toggle_inject ${input.docId} failed`, e)
      throw e
    }
  });
}

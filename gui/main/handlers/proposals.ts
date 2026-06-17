import { ipcMain } from "electron";
import { cwd } from "process";
import {
  readProposal,
  createProposal,
  updateProposal,
  deleteProposal,
  listProposals,
  approveProposal,
  type TaskDraft,
  type DocumentDraft,
} from "../../../storage/proposalIndex";
import type { Proposal } from "../../../storage/proposalIndex";
import { listTasks, deleteTaskInfo } from "../../../storage/taskIndex";
import { deleteSessionInfo } from "../../../storage/sessionIndex";
import { deleteTranscript } from "../../../storage/transcript";
import { createId } from "../../../shared/ids";
import { log } from "../logger";

interface ProposalCreateInput {
  title: string;
  description?: string;
  inputType?: "idea" | "manual";
  inputIds?: string[];
  createdBy?: string;
}

interface ProposalUpdateInput {
  proposalId: string;
  title?: string;
  description?: string;
  status?: string;
}

interface TaskDraftInput {
  title: string;
  description?: string;
  agent?: string;
  priority?: "low" | "medium" | "high";
  dependsOnTempIds?: string[];
  acceptanceCriteria?: string[];
  relatedDocumentTempIds?: string[];
}

interface DocumentDraftInput {
  type: "prd" | "tech_design" | "adr" | "spec" | "guide" | "report";
  title: string;
  content: string;
  relatedTaskTempIds?: string[];
}

export function registerProposalHandlers() {
  log('INFO', 'Proposals', 'Registering proposal handlers')

  ipcMain.handle("proposals:list", async (): Promise<{ proposals: Proposal[] }> => {
    log('INFO', 'Proposals', 'proposals:list called')
    try {
      const proposals = await listProposals(cwd());
      log('INFO', 'Proposals', `proposals:list returned ${proposals.length} proposals`)
      return { proposals };
    } catch (e) {
      log('ERROR', 'Proposals', 'proposals:list failed', e)
      throw e
    }
  });

  ipcMain.handle("proposals:get", async (_event, proposalId: string): Promise<{ proposal: Proposal | null }> => {
    log('INFO', 'Proposals', `proposals:get called for ${proposalId}`)
    try {
      const proposal = await readProposal(cwd(), proposalId);
      return { proposal };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:get ${proposalId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:create", async (_event, input: ProposalCreateInput): Promise<{ proposal: Proposal }> => {
    log('INFO', 'Proposals', `proposals:create called: ${input.title}`)
    try {
      const proposal = await createProposal(cwd(), {
        id: createId("proposal"),
        title: input.title,
        description: input.description,
        inputType: input.inputType || "manual",
        inputIds: input.inputIds,
        status: "draft",
        taskDrafts: [],
        documentDrafts: [],
        createdBy: input.createdBy,
      });
      log('INFO', 'Proposals', `proposals:create created ${proposal.id}`)
      return { proposal };
    } catch (e) {
      log('ERROR', 'Proposals', 'proposals:create failed', e)
      throw e
    }
  });

  ipcMain.handle("proposals:update", async (_event, input: ProposalUpdateInput): Promise<{ proposal: Proposal | null }> => {
    log('INFO', 'Proposals', `proposals:update called for ${input.proposalId}`)
    try {
      const updates: any = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.status !== undefined) updates.status = input.status;

      const proposal = await updateProposal(cwd(), input.proposalId, updates);
      return { proposal };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:update ${input.proposalId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:delete", async (_event, proposalId: string): Promise<void> => {
    log('INFO', 'Proposals', `proposals:delete called for ${proposalId}`)
    try {
      await deleteProposal(cwd(), proposalId);
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:delete ${proposalId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:delete_with_tasks", async (_event, proposalId: string): Promise<{ deletedTasks: number; deletedSessions: number }> => {
    log('INFO', 'Proposals', `proposals:delete_with_tasks called for ${proposalId}`)
    try {
      const proposal = await readProposal(cwd(), proposalId);
      if (!proposal) throw new Error("Proposal not found");

      // Find tasks created from this proposal (by proposalId foreign key)
      const allTasks = await listTasks(cwd());
      const relatedTasks = allTasks.filter(t => t.proposalId === proposalId);

      let deletedTasks = 0;
      let deletedSessions = 0;

      // Delete related tasks and their sessions
      for (const task of relatedTasks) {
        if (task.sessionId) {
          try {
            await deleteSessionInfo(cwd(), task.sessionId);
            await deleteTranscript(cwd(), task.sessionId);
            deletedSessions++;
          } catch (e) {
            log('WARN', 'Proposals', `Failed to delete session ${task.sessionId}:`, e);
          }
        }
        try {
          await deleteTaskInfo(cwd(), task.id);
          deletedTasks++;
        } catch (e) {
          log('WARN', 'Proposals', `Failed to delete task ${task.id}:`, e);
        }
      }

      // Delete the proposal
      await deleteProposal(cwd(), proposalId);

      log('INFO', 'Proposals', `proposals:delete_with_tasks done: ${deletedTasks} tasks, ${deletedSessions} sessions deleted`)
      return { deletedTasks, deletedSessions };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:delete_with_tasks ${proposalId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:revert", async (_event, proposalId: string): Promise<{ proposal: Proposal | null; deletedTasks: number }> => {
    log('INFO', 'Proposals', `proposals:revert called for ${proposalId}`)
    try {
      const proposal = await readProposal(cwd(), proposalId);
      if (!proposal) throw new Error("Proposal not found");

      let deletedTasks = 0;

      // If proposal was approved, delete associated tasks first
      if (proposal.status === 'approved') {
        const allTasks = await listTasks(cwd());
        const relatedTasks = allTasks.filter(t => t.proposalId === proposalId);

        for (const task of relatedTasks) {
          if (task.sessionId) {
            try {
              await deleteSessionInfo(cwd(), task.sessionId);
              await deleteTranscript(cwd(), task.sessionId);
            } catch (e) {
              log('WARN', 'Proposals', `Failed to delete session ${task.sessionId}:`, e);
            }
          }
          try {
            await deleteTaskInfo(cwd(), task.id);
            deletedTasks++;
          } catch (e) {
            log('WARN', 'Proposals', `Failed to delete task ${task.id}:`, e);
          }
        }
      }

      // Revert status to draft (works for pending, rejected, and approved)
      const updated = await updateProposal(cwd(), proposalId, { status: 'draft' });

      log('INFO', 'Proposals', `proposals:revert done: reverted to draft, ${deletedTasks} tasks deleted`)
      return { proposal: updated, deletedTasks };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:revert ${proposalId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:add_task_draft", async (_event, input: { proposalId: string; draft: TaskDraftInput }): Promise<{ proposal: Proposal | null }> => {
    log('INFO', 'Proposals', `proposals:add_task_draft for ${input.proposalId}`)
    try {
      const proposal = await readProposal(cwd(), input.proposalId);
      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "draft") throw new Error("Can only edit drafts");

      const newDraft: TaskDraft = {
        // Preserve the original tempId from the editor (needed for dependency resolution)
        tempId: input.draft.tempId || createId("draft"),
        title: input.draft.title,
        description: input.draft.description,
        agent: input.draft.agent,
        priority: input.draft.priority,
        dependsOnTempIds: input.draft.dependsOnTempIds,
        acceptanceCriteria: input.draft.acceptanceCriteria,
      };

      const updated = await updateProposal(cwd(), input.proposalId, {
        taskDrafts: [...proposal.taskDrafts, newDraft],
      });
      return { proposal: updated };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:add_task_draft failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:remove_task_draft", async (_event, input: { proposalId: string; tempId: string }): Promise<{ proposal: Proposal | null }> => {
    log('INFO', 'Proposals', `proposals:remove_task_draft ${input.tempId} from ${input.proposalId}`)
    try {
      const proposal = await readProposal(cwd(), input.proposalId);
      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "draft") throw new Error("Can only edit drafts");

      const updated = await updateProposal(cwd(), input.proposalId, {
        taskDrafts: proposal.taskDrafts.filter((d) => d.tempId !== input.tempId),
      });
      return { proposal: updated };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:remove_task_draft failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:update_task_draft", async (_event, input: { proposalId: string; tempId: string; updates: Partial<TaskDraftInput> }): Promise<{ proposal: Proposal | null }> => {
    log('INFO', 'Proposals', `proposals:update_task_draft ${input.tempId}`)
    try {
      const proposal = await readProposal(cwd(), input.proposalId);
      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "draft") throw new Error("Can only edit drafts");

      const taskDrafts = proposal.taskDrafts.map((d) =>
        d.tempId === input.tempId ? { ...d, ...input.updates } : d
      );

      const updated = await updateProposal(cwd(), input.proposalId, { taskDrafts });
      return { proposal: updated };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:update_task_draft failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:add_document_draft", async (_event, input: { proposalId: string; draft: DocumentDraftInput }): Promise<{ proposal: Proposal | null }> => {
    log('INFO', 'Proposals', `proposals:add_document_draft for ${input.proposalId}`)
    try {
      const proposal = await readProposal(cwd(), input.proposalId);
      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "draft") throw new Error("Can only edit drafts");

      const newDraft: DocumentDraft = {
        tempId: createId("doc"),
        type: input.draft.type,
        title: input.draft.title,
        content: input.draft.content,
      };

      const updated = await updateProposal(cwd(), input.proposalId, {
        documentDrafts: [...proposal.documentDrafts, newDraft],
      });
      return { proposal: updated };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:add_document_draft failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:remove_document_draft", async (_event, input: { proposalId: string; tempId: string }): Promise<{ proposal: Proposal | null }> => {
    log('INFO', 'Proposals', `proposals:remove_document_draft ${input.tempId}`)
    try {
      const proposal = await readProposal(cwd(), input.proposalId);
      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "draft") throw new Error("Can only edit drafts");

      const updated = await updateProposal(cwd(), input.proposalId, {
        documentDrafts: proposal.documentDrafts.filter((d) => d.tempId !== input.tempId),
      });
      return { proposal: updated };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:remove_document_draft failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:update_document_draft", async (_event, input: { proposalId: string; tempId: string; updates: Partial<DocumentDraftInput> }): Promise<{ proposal: Proposal | null }> => {
    log('INFO', 'Proposals', `proposals:update_document_draft ${input.tempId}`)
    try {
      const proposal = await readProposal(cwd(), input.proposalId);
      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "draft") throw new Error("Can only edit drafts");

      const documentDrafts = proposal.documentDrafts.map((d) =>
        d.tempId === input.tempId ? { ...d, ...input.updates } : d
      );

      const updated = await updateProposal(cwd(), input.proposalId, { documentDrafts });
      return { proposal: updated };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:update_document_draft failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:submit", async (_event, proposalId: string): Promise<{ proposal: Proposal | null }> => {
    log('INFO', 'Proposals', `proposals:submit called for ${proposalId}`)
    try {
      const proposal = await readProposal(cwd(), proposalId);
      if (!proposal) throw new Error("Proposal not found");
      if (proposal.taskDrafts.length === 0) throw new Error("Cannot submit proposal with no task drafts");

      const updated = await updateProposal(cwd(), proposalId, { status: "pending" });
      log('INFO', 'Proposals', `proposals:submit ${proposalId} success`)
      return { proposal: updated };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:submit ${proposalId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:approve", async (_event, proposalId: string): Promise<{ proposal: Proposal; tasks: Array<{ id: string; title: string }>; documents: Array<{ id: string; title: string }> }> => {
    log('INFO', 'Proposals', `proposals:approve called for ${proposalId}`)
    try {
      const result = await approveProposal(cwd(), proposalId);
      log('INFO', 'Proposals', `proposals:approve ${proposalId} created ${result.tasks.length} tasks, ${result.documents.length} documents`)
      return result;
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:approve ${proposalId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("proposals:reject", async (_event, proposalId: string): Promise<{ proposal: Proposal | null }> => {
    log('INFO', 'Proposals', `proposals:reject called for ${proposalId}`)
    try {
      const updated = await updateProposal(cwd(), proposalId, { status: "rejected" });
      return { proposal: updated };
    } catch (e) {
      log('ERROR', 'Proposals', `proposals:reject ${proposalId} failed`, e)
      throw e
    }
  });
}

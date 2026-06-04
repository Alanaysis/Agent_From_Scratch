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
      const proposal = await updateProposal(cwd(), input.proposalId, {
        title: input.title,
        description: input.description,
      });
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

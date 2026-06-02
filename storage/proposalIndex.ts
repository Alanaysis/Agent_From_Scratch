import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { createTask, updateTaskInfo, type TaskInfo } from "./taskIndex";
import { createDocument, updateDocument } from "./documentIndex";
import { createId } from "../shared/ids";

export type TaskDraft = {
  tempId: string;
  title: string;
  description?: string;
  agent?: string;
  priority?: "low" | "medium" | "high";
  dependsOnTempIds?: string[];
  acceptanceCriteria?: string[];
  relatedDocumentTempIds?: string[];
  requiresApproval?: boolean;
  approvalMessage?: string;
};

export type DocumentDraft = {
  tempId: string;
  type: "prd" | "tech_design" | "adr" | "spec" | "guide" | "report";
  title: string;
  content: string;
  relatedTaskTempIds?: string[];
};

export type Proposal = {
  id: string;
  title: string;
  description?: string;
  inputType: "idea" | "manual";
  inputIds?: string[];
  status: "draft" | "pending" | "approved" | "rejected";
  taskDrafts: TaskDraft[];
  documentDrafts: DocumentDraft[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  createdBy?: string;
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending"],
  pending: ["approved", "rejected"],
  approved: [],
  rejected: ["draft"],
};

export function isValidProposalTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function getProposalsDir(cwd: string): string {
  return join(cwd, ".irg", "proposals");
}

function getProposalPath(cwd: string, proposalId: string): string {
  return join(getProposalsDir(cwd), `${proposalId}.json`);
}

export async function readProposal(
  cwd: string,
  proposalId: string,
): Promise<Proposal | null> {
  try {
    const content = await readFile(getProposalPath(cwd, proposalId), "utf8");
    return JSON.parse(content) as Proposal;
  } catch {
    return null;
  }
}

export async function createProposal(
  cwd: string,
  proposal: Omit<Proposal, "createdAt" | "updatedAt">,
): Promise<Proposal> {
  const now = new Date().toISOString();
  const newProposal: Proposal = {
    ...proposal,
    createdAt: now,
    updatedAt: now,
  };

  await mkdir(getProposalsDir(cwd), { recursive: true });
  await writeFile(
    getProposalPath(cwd, proposal.id),
    `${JSON.stringify(newProposal, null, 2)}\n`,
    "utf8",
  );
  return newProposal;
}

export async function updateProposal(
  cwd: string,
  proposalId: string,
  updates: Partial<Omit<Proposal, "id" | "createdAt">>,
): Promise<Proposal | null> {
  const previous = await readProposal(cwd, proposalId);
  if (!previous) {
    return null;
  }

  if (updates.status && updates.status !== previous.status) {
    if (!isValidProposalTransition(previous.status, updates.status)) {
      throw new Error(
        `Invalid proposal transition from "${previous.status}" to "${updates.status}". ` +
        `Valid transitions: ${VALID_TRANSITIONS[previous.status]?.join(", ") || "none"}`
      );
    }
  }

  const updated: Proposal = {
    ...previous,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(getProposalsDir(cwd), { recursive: true });
  await writeFile(
    getProposalPath(cwd, proposalId),
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
  return updated;
}

export async function deleteProposal(
  cwd: string,
  proposalId: string,
): Promise<void> {
  await rm(getProposalPath(cwd, proposalId), { force: true });
}

export async function listProposals(cwd: string): Promise<Proposal[]> {
  const proposals: Proposal[] = [];

  try {
    const entries = await readdir(getProposalsDir(cwd));
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const proposalId = entry.replace(/\.json$/, "");
      const proposal = await readProposal(cwd, proposalId);
      if (proposal) {
        proposals.push(proposal);
      }
    }
  } catch {
    // ignore missing directory
  }

  return proposals.sort((a, b) => {
    const statusOrder: Record<string, number> = {
      pending: 0,
      draft: 1,
      rejected: 2,
      approved: 3,
    };
    const aRank = statusOrder[a.status] ?? 4;
    const bRank = statusOrder[b.status] ?? 4;
    if (aRank !== bRank) return aRank - bRank;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
}

/**
 * Approve a proposal and materialize its drafts into real tasks and documents.
 * Uses the two-phase pattern: create all tasks without dependencies first,
 * then resolve dependencies using the tempId → taskId mapping.
 */
export async function approveProposal(
  cwd: string,
  proposalId: string,
): Promise<{
  proposal: Proposal;
  tasks: Array<{ id: string; title: string }>;
  documents: Array<{ id: string; title: string }>;
}> {
  const proposal = await readProposal(cwd, proposalId);
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }
  if (proposal.status !== "pending") {
    throw new Error(`Cannot approve proposal in "${proposal.status}" status. Must be "pending".`);
  }

  const createdTasks: Array<{ id: string; title: string }> = [];
  const createdDocuments: Array<{ id: string; title: string }> = [];
  const tempIdToTaskId = new Map<string, string>();
  const tempIdToDocId = new Map<string, string>();

  try {
    // Phase 1: Create all tasks without dependencies
    for (const draft of proposal.taskDrafts) {
      const taskId = createId("task");
      tempIdToTaskId.set(draft.tempId, taskId);

      const acceptanceCriteria = (draft.acceptanceCriteria || []).map((text) => ({
        id: createId("ac"),
        text,
        status: "pending" as const,
      }));

      const task = await createTask(cwd, {
        id: taskId,
        title: draft.title,
        description: draft.description,
        priority: draft.priority || "medium",
        status: "todo",
        assignee: draft.agent,
        createdBy: proposal.createdBy,
        acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
        requiresApproval: draft.requiresApproval || false,
        approvalMessage: draft.approvalMessage,
      });

      createdTasks.push({ id: taskId, title: draft.title });
    }

    // Phase 2: Resolve dependencies
    for (const draft of proposal.taskDrafts) {
      if (!draft.dependsOnTempIds || draft.dependsOnTempIds.length === 0) continue;

      const taskId = tempIdToTaskId.get(draft.tempId);
      if (!taskId) continue;

      const resolvedDependsOn: string[] = [];
      for (const tempId of draft.dependsOnTempIds) {
        const depTaskId = tempIdToTaskId.get(tempId);
        if (depTaskId) {
          resolvedDependsOn.push(depTaskId);
        } else {
          console.warn(`[approveProposal] Unresolvable dependsOnTempId "${tempId}" in draft "${draft.title}"`)
        }
      }

      if (resolvedDependsOn.length > 0) {
        await updateTaskInfo(cwd, taskId, { dependsOn: resolvedDependsOn }, proposal.createdBy);
      }
    }

    // Phase 3: Create documents from drafts
    for (const draft of proposal.documentDrafts) {
      const docId = createId("doc");
      tempIdToDocId.set(draft.tempId, docId);
      const doc = await createDocument(cwd, {
        id: docId,
        title: draft.title,
        type: draft.type as any,
        content: draft.content,
        proposalId,
        createdBy: proposal.createdBy,
      });
      createdDocuments.push({ id: docId, title: doc.title });
    }

    // Phase 4: Resolve cross-references between tasks and documents
    for (const draft of proposal.taskDrafts) {
      if (!draft.relatedDocumentTempIds || draft.relatedDocumentTempIds.length === 0) continue;
      const taskId = tempIdToTaskId.get(draft.tempId);
      if (!taskId) continue;
      const resolvedDocIds = draft.relatedDocumentTempIds
        .map(tid => tempIdToDocId.get(tid))
        .filter(Boolean) as string[];
      if (resolvedDocIds.length > 0) {
        await updateTaskInfo(cwd, taskId, { relatedDocumentIds: resolvedDocIds }, proposal.createdBy);
      }
    }
    for (const draft of proposal.documentDrafts) {
      if (!draft.relatedTaskTempIds || draft.relatedTaskTempIds.length === 0) continue;
      const docId = tempIdToDocId.get(draft.tempId);
      if (!docId) continue;
      const resolvedTaskIds = draft.relatedTaskTempIds
        .map(tid => tempIdToTaskId.get(tid))
        .filter(Boolean) as string[];
      if (resolvedTaskIds.length > 0) {
        await updateDocument(cwd, docId, { relatedTaskIds: resolvedTaskIds });
      }
    }

    // Phase 5: Mark proposal as approved
    const approved = await updateProposal(cwd, proposalId, {
      status: "approved",
      approvedAt: new Date().toISOString(),
    });

    return {
      proposal: approved!,
      tasks: createdTasks,
      documents: createdDocuments,
    };
  } catch (error) {
    // Rollback: delete created tasks and documents
    const { deleteTaskInfo } = await import("./taskIndex");
    const { deleteDocument } = await import("./documentIndex");
    for (const task of createdTasks) {
      await deleteTaskInfo(cwd, task.id).catch(() => {});
    }
    for (const doc of createdDocuments) {
      await deleteDocument(cwd, doc.id).catch(() => {});
    }
    throw error;
  }
}

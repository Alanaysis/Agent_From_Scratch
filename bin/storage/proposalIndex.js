import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { createTask, updateTaskInfo } from "./taskIndex";
import { createDocument, updateDocument } from "./documentIndex";
import { createId } from "../shared/ids";
const VALID_TRANSITIONS = {
    draft: ["pending"],
    pending: ["approved", "rejected", "draft"],
    approved: ["draft"],
    rejected: ["draft"],
};
export function isValidProposalTransition(from, to) {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
function getProposalsDir(cwd) {
    return join(cwd, ".irg", "proposals");
}
function getProposalPath(cwd, proposalId) {
    return join(getProposalsDir(cwd), `${proposalId}.json`);
}
export async function readProposal(cwd, proposalId) {
    try {
        const content = await readFile(getProposalPath(cwd, proposalId), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export async function createProposal(cwd, proposal) {
    const now = new Date().toISOString();
    const newProposal = {
        ...proposal,
        createdAt: now,
        updatedAt: now,
    };
    await mkdir(getProposalsDir(cwd), { recursive: true });
    await writeFile(getProposalPath(cwd, proposal.id), `${JSON.stringify(newProposal, null, 2)}\n`, "utf8");
    return newProposal;
}
export async function updateProposal(cwd, proposalId, updates) {
    const previous = await readProposal(cwd, proposalId);
    if (!previous) {
        return null;
    }
    if (updates.status && updates.status !== previous.status) {
        if (!isValidProposalTransition(previous.status, updates.status)) {
            throw new Error(`Invalid proposal transition from "${previous.status}" to "${updates.status}". ` +
                `Valid transitions: ${VALID_TRANSITIONS[previous.status]?.join(", ") || "none"}`);
        }
    }
    const updated = {
        ...previous,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await mkdir(getProposalsDir(cwd), { recursive: true });
    await writeFile(getProposalPath(cwd, proposalId), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    return updated;
}
export async function deleteProposal(cwd, proposalId) {
    await rm(getProposalPath(cwd, proposalId), { force: true });
}
export async function listProposals(cwd) {
    const proposals = [];
    try {
        const entries = await readdir(getProposalsDir(cwd));
        for (const entry of entries) {
            if (!entry.endsWith(".json"))
                continue;
            const proposalId = entry.replace(/\.json$/, "");
            const proposal = await readProposal(cwd, proposalId);
            if (proposal) {
                proposals.push(proposal);
            }
        }
    }
    catch {
        // ignore missing directory
    }
    return proposals.sort((a, b) => {
        const statusOrder = {
            pending: 0,
            draft: 1,
            rejected: 2,
            approved: 3,
        };
        const aRank = statusOrder[a.status] ?? 4;
        const bRank = statusOrder[b.status] ?? 4;
        if (aRank !== bRank)
            return aRank - bRank;
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });
}
/**
 * Approve a proposal and materialize its drafts into real tasks and documents.
 * Uses the two-phase pattern: create all tasks without dependencies first,
 * then resolve dependencies using the tempId → taskId mapping.
 */
export async function approveProposal(cwd, proposalId) {
    const proposal = await readProposal(cwd, proposalId);
    if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`);
    }
    if (proposal.status !== "pending") {
        throw new Error(`Cannot approve proposal in "${proposal.status}" status. Must be "pending".`);
    }
    const createdTasks = [];
    const createdDocuments = [];
    const tempIdToTaskId = new Map();
    const tempIdToDocId = new Map();
    try {
        // Phase 1: Create all tasks without dependencies
        for (const draft of proposal.taskDrafts) {
            const taskId = createId("task");
            tempIdToTaskId.set(draft.tempId, taskId);
            const acceptanceCriteria = (draft.acceptanceCriteria || []).map((text) => ({
                id: createId("ac"),
                text,
                status: "pending",
            }));
            const task = await createTask(cwd, {
                id: taskId,
                title: draft.title,
                description: draft.description,
                priority: draft.priority || "medium",
                status: "todo",
                assignee: draft.agent || "general-purpose",
                createdBy: proposal.createdBy,
                proposalId: proposal.id,
                acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
                requiresApproval: draft.requiresApproval || false,
                approvalMessage: draft.approvalMessage,
                checkpointAfter: draft.checkpointAfter || false,
                checkpointMessage: draft.checkpointMessage,
                grpcConfig: draft.grpcConfig,
                condition: draft.condition,
                loop: draft.loop,
            });
            createdTasks.push({ id: taskId, title: draft.title });
        }
        // Phase 2: Resolve dependencies and conditions/loops
        for (const draft of proposal.taskDrafts) {
            const taskId = tempIdToTaskId.get(draft.tempId);
            if (!taskId)
                continue;
            const updateData = {};
            // Resolve dependencies
            if (draft.dependsOnTempIds && draft.dependsOnTempIds.length > 0) {
                const resolvedDependsOn = [];
                for (const tempId of draft.dependsOnTempIds) {
                    const depTaskId = tempIdToTaskId.get(tempId);
                    if (depTaskId) {
                        resolvedDependsOn.push(depTaskId);
                    }
                    else {
                        console.warn(`[approveProposal] Unresolvable dependsOnTempId "${tempId}" in draft "${draft.title}"`);
                    }
                }
                if (resolvedDependsOn.length > 0) {
                    updateData.dependsOn = resolvedDependsOn;
                }
            }
            // Resolve condition source
            if (draft.condition && draft.condition.source) {
                const resolvedCondition = { ...draft.condition };
                const newSource = tempIdToTaskId.get(draft.condition.source);
                if (newSource) {
                    resolvedCondition.source = newSource;
                }
                updateData.condition = resolvedCondition;
            }
            // Resolve loop configuration
            if (draft.loop) {
                const resolvedLoop = { ...draft.loop };
                // Resolve steps array
                if (resolvedLoop.steps && resolvedLoop.steps.length > 0) {
                    const resolvedSteps = resolvedLoop.steps.map((stepId) => {
                        const newId = tempIdToTaskId.get(stepId);
                        return newId || stepId;
                    });
                    resolvedLoop.steps = resolvedSteps;
                }
                // Resolve until condition source
                if (resolvedLoop.until && resolvedLoop.until.source) {
                    const newUntilSource = tempIdToTaskId.get(resolvedLoop.until.source);
                    if (newUntilSource) {
                        resolvedLoop.until = { ...resolvedLoop.until, source: newUntilSource };
                    }
                }
                updateData.loop = resolvedLoop;
            }
            if (Object.keys(updateData).length > 0) {
                await updateTaskInfo(cwd, taskId, updateData, proposal.createdBy);
            }
        }
        // Phase 3: Create documents from drafts
        for (const draft of proposal.documentDrafts) {
            const docId = createId("doc");
            tempIdToDocId.set(draft.tempId, docId);
            const doc = await createDocument(cwd, {
                id: docId,
                title: draft.title,
                type: draft.type,
                content: draft.content,
                proposalId,
                createdBy: proposal.createdBy,
            });
            createdDocuments.push({ id: docId, title: doc.title });
        }
        // Phase 4: Resolve cross-references between tasks and documents
        for (const draft of proposal.taskDrafts) {
            if (!draft.relatedDocumentTempIds || draft.relatedDocumentTempIds.length === 0)
                continue;
            const taskId = tempIdToTaskId.get(draft.tempId);
            if (!taskId)
                continue;
            const resolvedDocIds = draft.relatedDocumentTempIds
                .map(tid => tempIdToDocId.get(tid))
                .filter(Boolean);
            if (resolvedDocIds.length > 0) {
                await updateTaskInfo(cwd, taskId, { relatedDocumentIds: resolvedDocIds }, proposal.createdBy);
            }
        }
        for (const draft of proposal.documentDrafts) {
            if (!draft.relatedTaskTempIds || draft.relatedTaskTempIds.length === 0)
                continue;
            const docId = tempIdToDocId.get(draft.tempId);
            if (!docId)
                continue;
            const resolvedTaskIds = draft.relatedTaskTempIds
                .map(tid => tempIdToTaskId.get(tid))
                .filter(Boolean);
            if (resolvedTaskIds.length > 0) {
                await updateDocument(cwd, docId, { relatedTaskIds: resolvedTaskIds });
            }
        }
        // Phase 5: Mark proposal as approved
        const approved = await updateProposal(cwd, proposalId, {
            status: "approved",
            approvedAt: new Date().toISOString(),
        });
        if (!approved) {
            throw new Error(`Failed to update proposal ${proposalId} — it may have been deleted`);
        }
        return {
            proposal: approved,
            tasks: createdTasks,
            documents: createdDocuments,
        };
    }
    catch (error) {
        // Rollback: delete created tasks and documents
        const { deleteTaskInfo } = await import("./taskIndex");
        const { deleteDocument } = await import("./documentIndex");
        for (const task of createdTasks) {
            await deleteTaskInfo(cwd, task.id).catch(() => { });
        }
        for (const doc of createdDocuments) {
            await deleteDocument(cwd, doc.id).catch(() => { });
        }
        throw error;
    }
}

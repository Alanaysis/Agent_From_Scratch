import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
export const DOCUMENT_TYPES = {
    prd: { label: "PRD", color: "#3b82f6" },
    tech_design: { label: "Tech Design", color: "#8b5cf6" },
    adr: { label: "ADR", color: "#f59e0b" },
    spec: { label: "Spec", color: "#22c55e" },
    guide: { label: "Guide", color: "#06b6d4" },
    report: { label: "Report", color: "#ef4444" },
};
function getDocumentsDir(cwd) {
    return join(cwd, ".irg", "documents");
}
function getDocumentPath(cwd, docId) {
    return join(getDocumentsDir(cwd), `${docId}.json`);
}
export async function readDocument(cwd, docId) {
    try {
        const content = await readFile(getDocumentPath(cwd, docId), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export async function createDocument(cwd, doc) {
    const now = new Date().toISOString();
    const newDoc = {
        ...doc,
        createdAt: now,
        updatedAt: now,
    };
    await mkdir(getDocumentsDir(cwd), { recursive: true });
    await writeFile(getDocumentPath(cwd, doc.id), `${JSON.stringify(newDoc, null, 2)}\n`, "utf8");
    return newDoc;
}
export async function updateDocument(cwd, docId, updates) {
    const previous = await readDocument(cwd, docId);
    if (!previous)
        return null;
    // Filter out undefined values to prevent overwriting existing fields
    const cleanUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            cleanUpdates[key] = value;
        }
    }
    const updated = {
        ...previous,
        ...cleanUpdates,
        updatedAt: new Date().toISOString(),
    };
    await mkdir(getDocumentsDir(cwd), { recursive: true });
    await writeFile(getDocumentPath(cwd, docId), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    return updated;
}
export async function deleteDocument(cwd, docId) {
    await rm(getDocumentPath(cwd, docId), { force: true });
}
export async function listDocuments(cwd) {
    const docs = [];
    try {
        const entries = await readdir(getDocumentsDir(cwd));
        for (const entry of entries) {
            if (!entry.endsWith(".json"))
                continue;
            const docId = entry.replace(/\.json$/, "");
            const doc = await readDocument(cwd, docId);
            if (doc)
                docs.push(doc);
        }
    }
    catch {
        // ignore missing directory
    }
    return docs.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
export async function listDocumentsByProposal(cwd, proposalId) {
    const all = await listDocuments(cwd);
    return all.filter((d) => d.proposalId === proposalId);
}

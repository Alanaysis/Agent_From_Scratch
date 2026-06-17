import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";

export type DocumentType = "prd" | "tech_design" | "adr" | "spec" | "guide" | "report";

export const DOCUMENT_TYPES: Record<DocumentType, { label: string; color: string }> = {
  prd: { label: "PRD", color: "#3b82f6" },
  tech_design: { label: "Tech Design", color: "#8b5cf6" },
  adr: { label: "ADR", color: "#f59e0b" },
  spec: { label: "Spec", color: "#22c55e" },
  guide: { label: "Guide", color: "#06b6d4" },
  report: { label: "Report", color: "#ef4444" },
};

export type StoredDocument = {
  id: string;
  title: string;
  type: DocumentType;
  content: string;
  proposalId?: string;
  relatedTaskIds?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

function getDocumentsDir(cwd: string): string {
  return join(cwd, ".irg", "documents");
}

function getDocumentPath(cwd: string, docId: string): string {
  return join(getDocumentsDir(cwd), `${docId}.json`);
}

export async function readDocument(
  cwd: string,
  docId: string,
): Promise<StoredDocument | null> {
  try {
    const content = await readFile(getDocumentPath(cwd, docId), "utf8");
    return JSON.parse(content) as StoredDocument;
  } catch {
    return null;
  }
}

export async function createDocument(
  cwd: string,
  doc: Omit<StoredDocument, "createdAt" | "updatedAt">,
): Promise<StoredDocument> {
  const now = new Date().toISOString();
  const newDoc: StoredDocument = {
    ...doc,
    createdAt: now,
    updatedAt: now,
  };

  await mkdir(getDocumentsDir(cwd), { recursive: true });
  await writeFile(
    getDocumentPath(cwd, doc.id),
    `${JSON.stringify(newDoc, null, 2)}\n`,
    "utf8",
  );
  return newDoc;
}

export async function updateDocument(
  cwd: string,
  docId: string,
  updates: Partial<Omit<StoredDocument, "id" | "createdAt">>,
): Promise<StoredDocument | null> {
  const previous = await readDocument(cwd, docId);
  if (!previous) return null;

  // Filter out undefined values to prevent overwriting existing fields
  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  const updated: StoredDocument = {
    ...previous,
    ...cleanUpdates,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(getDocumentsDir(cwd), { recursive: true });
  await writeFile(
    getDocumentPath(cwd, docId),
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
  return updated;
}

export async function deleteDocument(
  cwd: string,
  docId: string,
): Promise<void> {
  await rm(getDocumentPath(cwd, docId), { force: true });
}

export async function listDocuments(cwd: string): Promise<StoredDocument[]> {
  const docs: StoredDocument[] = [];

  try {
    const entries = await readdir(getDocumentsDir(cwd));
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const docId = entry.replace(/\.json$/, "");
      const doc = await readDocument(cwd, docId);
      if (doc) docs.push(doc);
    }
  } catch {
    // ignore missing directory
  }

  return docs.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function listDocumentsByProposal(
  cwd: string,
  proposalId: string,
): Promise<StoredDocument[]> {
  const all = await listDocuments(cwd);
  return all.filter((d) => d.proposalId === proposalId);
}

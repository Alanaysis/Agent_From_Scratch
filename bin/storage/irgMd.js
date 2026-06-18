import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { readDocument } from "./documentIndex";
const IRG_MD_FILENAME = "irg.md";
const IRG_LOCAL_FILENAME = "irg.local.md";
/**
 * Read irg.md content with hierarchical loading:
 * 1. Global: ~/.irg/irg.md
 * 2. Project: <cwd>/irg.md
 * 3. Local override: <cwd>/irg.local.md (gitignored, appended last)
 */
export async function readIrgMd(cwd) {
    const parts = [];
    // 1. Global irg.md
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    if (homeDir) {
        try {
            const globalContent = await readFile(join(homeDir, ".irg", IRG_MD_FILENAME), "utf8");
            if (globalContent.trim())
                parts.push(globalContent.trim());
        }
        catch {
            // not found — ok
        }
    }
    // 2. Project irg.md
    try {
        const projectContent = await readFile(join(cwd, IRG_MD_FILENAME), "utf8");
        if (projectContent.trim())
            parts.push(projectContent.trim());
    }
    catch {
        // not found — ok
    }
    // 3. Local override (appended last so it can override)
    try {
        const localContent = await readFile(join(cwd, IRG_LOCAL_FILENAME), "utf8");
        if (localContent.trim())
            parts.push(localContent.trim());
    }
    catch {
        // not found — ok
    }
    return parts.join("\n\n");
}
/**
 * Parse @doc:xxx references from irg.md content.
 * Returns an array of document IDs.
 */
export function parseDocRefs(content) {
    const refs = [];
    const regex = /@doc:([\w-]+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        refs.push(match[1]);
    }
    return refs;
}
/**
 * Add a @doc:xxx reference to the project irg.md.
 * Creates the file if it doesn't exist. Adds under a "## 工具参考" section.
 */
export async function addDocRef(cwd, docId) {
    const filePath = join(cwd, IRG_MD_FILENAME);
    let content = "";
    try {
        content = await readFile(filePath, "utf8");
    }
    catch {
        // File doesn't exist, create with header
        content = "# IRG 项目指令\n";
    }
    const refLine = `@doc:${docId}`;
    // Check if already exists
    if (content.includes(refLine)) {
        return;
    }
    // Find or create "## 工具参考" section
    const sectionHeader = "## 工具参考";
    if (content.includes(sectionHeader)) {
        // Append to existing section — find the section and add after its header
        const sectionIndex = content.indexOf(sectionHeader);
        const afterHeader = sectionIndex + sectionHeader.length;
        // Find the next line after the header
        const nextNewline = content.indexOf("\n", afterHeader);
        const insertAt = nextNewline === -1 ? content.length : nextNewline + 1;
        content = content.slice(0, insertAt) + refLine + "\n" + content.slice(insertAt);
    }
    else {
        // Add new section at the end
        content = content.trimEnd() + "\n\n" + sectionHeader + "\n" + refLine + "\n";
    }
    await writeFile(filePath, content, "utf8");
}
/**
 * Remove a @doc:xxx reference from the project irg.md.
 */
export async function removeDocRef(cwd, docId) {
    const filePath = join(cwd, IRG_MD_FILENAME);
    let content;
    try {
        content = await readFile(filePath, "utf8");
    }
    catch {
        return; // File doesn't exist, nothing to remove
    }
    const refLine = `@doc:${docId}`;
    if (!content.includes(refLine)) {
        return; // Reference not found
    }
    // Remove the line containing the reference
    const lines = content.split("\n");
    const filtered = lines.filter((line) => line.trim() !== refLine);
    content = filtered.join("\n");
    // Clean up empty "## 工具参考" section
    content = content.replace(/## 工具参考\n+$/m, "");
    await writeFile(filePath, content, "utf8");
}
/**
 * Check if a document is currently injected (referenced in irg.md).
 */
export async function isDocInjected(cwd, docId) {
    try {
        const content = await readIrgMd(cwd);
        return content.includes(`@doc:${docId}`);
    }
    catch {
        return false;
    }
}
/**
 * Get full injection content: irg.md content with @doc:xxx references
 * resolved to actual document content.
 */
export async function getFullInjectionContent(cwd) {
    const irgContent = await readIrgMd(cwd);
    if (!irgContent.trim())
        return "";
    const docRefs = parseDocRefs(irgContent);
    if (docRefs.length === 0)
        return irgContent;
    // Resolve document references
    const docContents = [];
    for (const docId of docRefs) {
        try {
            const doc = await readDocument(cwd, docId);
            if (doc) {
                docContents.push(`### ${doc.title}\n\n${doc.content}`);
            }
        }
        catch {
            // Document not found — skip
        }
    }
    if (docContents.length === 0)
        return irgContent;
    // Replace @doc:xxx references with actual content
    let result = irgContent;
    for (const docId of docRefs) {
        const refLine = `@doc:${docId}`;
        result = result.replace(refLine, `<!-- injected: ${docId} -->`);
    }
    // Append resolved document content
    result += "\n\n## Injected Tool Reference Documents\n\n";
    result += docContents.join("\n\n---\n\n");
    return result;
}

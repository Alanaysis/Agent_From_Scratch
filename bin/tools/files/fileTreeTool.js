import { readdir, stat } from "fs/promises";
import { resolve } from "path";
function getFileType(mode) {
    // S_IFMT = 0o170000, S_IFDIR = 0o40000, S_IFLNK = 0o120000
    if (mode & 0o120000)
        return "symlink";
    if (mode & 0o40000)
        return "directory";
    return "file";
}
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
async function buildTree(dirPath, cwd, relativePath, maxDepth, depth, fileLimit, includeHidden, counter) {
    const entry = {
        name: relativePath || ".",
        type: "directory",
        children: [],
    };
    let entries = [];
    try {
        const rawEntries = await readdir(dirPath, { withFileTypes: true });
        for (const re of rawEntries) {
            if (!includeHidden && re.name.startsWith("."))
                continue;
            const st = await stat(resolve(dirPath, re.name)).catch(() => null);
            if (!st)
                continue;
            entries.push({ name: re.name, mode: st.mode });
        }
    }
    catch {
        // If we can't read the directory, return an empty entry
    }
    // Sort: directories first, then files, alphabetically
    entries.sort((a, b) => {
        const aIsDir = a.mode & 0o40000;
        const bIsDir = b.mode & 0o40000;
        if (aIsDir !== bIsDir)
            return bIsDir - aIsDir;
        return a.name.localeCompare(b.name);
    });
    for (const e of entries) {
        if (counter.total >= fileLimit) {
            entry.children.push({
                name: "...",
                type: "file",
                size: 0,
            });
            break;
        }
        const childPath = resolve(dirPath, e.name);
        const childRel = relativePath ? `${relativePath}/${e.name}` : e.name;
        const fileType = getFileType(e.mode);
        if (fileType === "directory") {
            counter.dirs++;
            counter.total++;
            if (depth < maxDepth) {
                const childTree = await buildTree(childPath, cwd, childRel, maxDepth, depth + 1, fileLimit, includeHidden, counter);
                entry.children.push(childTree);
            }
            else {
                // Show directory name but don't recurse
                const childStat = await stat(childPath).catch(() => null);
                entry.children.push({
                    name: e.name,
                    type: "directory",
                });
            }
        }
        else {
            counter.files++;
            counter.total++;
            entry.children.push({
                name: e.name,
                type: "file",
                size: e.mode & 0o77777,
            });
        }
    }
    return entry;
}
export const FileTreeTool = {
    name: "FileTree",
    inputSchema: null,
    outputSchema: null,
    async description() {
        return "List directory contents recursively with file types and sizes.";
    },
    async call(args, context, _canUseTool, _parentMessage) {
        const targetPath = args.path
            ? resolve(context.cwd, args.path)
            : context.cwd;
        const maxDepth = args.maxDepth ?? 3;
        const fileLimit = args.fileLimit ?? 100;
        const includeHidden = args.includeHidden ?? false;
        const entry = await buildTree(targetPath, context.cwd, "", maxDepth, 0, fileLimit, includeHidden, { files: 0, dirs: 0, total: 0 });
        return {
            data: {
                entries: [entry],
                totalFiles: 0,
                totalDirs: 0,
                truncated: false,
            },
        };
    },
    async validateInput(input) {
        if (input.path && typeof input.path !== "string") {
            return { result: false, message: "Path must be a string" };
        }
        if (input.maxDepth !== undefined && (input.maxDepth < 0 || !Number.isInteger(input.maxDepth))) {
            return { result: false, message: "maxDepth must be a non-negative integer" };
        }
        if (input.fileLimit !== undefined && (input.fileLimit < 1 || !Number.isInteger(input.fileLimit))) {
            return { result: false, message: "fileLimit must be a positive integer" };
        }
        return { result: true };
    },
    async checkPermissions(input) {
        return {
            behavior: "allow",
            updatedInput: input,
        };
    },
    isReadOnly() {
        return true;
    },
    isConcurrencySafe() {
        return true;
    },
};

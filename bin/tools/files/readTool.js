import { readTextFile, resolvePathSafe } from "../../shared/fs";
export const ReadTool = {
    name: "Read",
    inputSchema: null,
    outputSchema: null,
    async description() {
        return "Read a file";
    },
    async call(args, context, _canUseTool, _parentMessage) {
        const absolutePath = resolvePathSafe(args.path, context.cwd);
        const content = await readTextFile(absolutePath);
        return {
            data: {
                content,
            },
        };
    },
    async validateInput(input) {
        if (!input?.path || typeof input.path !== 'string' || !input.path.trim()) {
            return { result: false, message: "Path is required" };
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

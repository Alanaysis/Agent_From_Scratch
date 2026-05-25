import { readTextFile, resolvePathFromCwd } from "../../shared/fs";
export const ReadTool = {
    name: "Read",
    inputSchema: null,
    outputSchema: null,
    async description() {
        return "Read a file";
    },
    async call(args, context, _canUseTool, _parentMessage) {
        const absolutePath = resolvePathFromCwd(context.cwd, args.path);
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

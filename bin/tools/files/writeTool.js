import { resolvePathFromCwd, writeTextFile } from "../../shared/fs";
export const WriteTool = {
    name: "Write",
    inputSchema: null,
    outputSchema: null,
    async description() {
        return "Write a file";
    },
    async call(args, context, _canUseTool, _parentMessage) {
        const absolutePath = resolvePathFromCwd(context.cwd, args.path);
        const bytesWritten = await writeTextFile(absolutePath, args.content);
        return {
            data: {
                bytesWritten,
            },
        };
    },
    async validateInput(input) {
        if (!input?.path || typeof input.path !== 'string' || !input.path.trim()) {
            return { result: false, message: "Path is required" };
        }
        if (typeof input.content !== 'string') {
            return { result: false, message: "Content must be a string" };
        }
        return { result: true };
    },
    async checkPermissions(input, context) {
        if (context.getAppState().permissionContext.mode === "default") {
            return {
                behavior: "ask",
                message: `Write requires confirmation for ${input.path}`,
            };
        }
        return {
            behavior: "allow",
            updatedInput: input,
        };
    },
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return true;
    },
};

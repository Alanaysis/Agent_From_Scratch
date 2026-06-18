// Store for pending checkpoint responses, keyed by checkpoint ID
const pendingResponses = new Map();
export function setCheckpointResponse(checkpointId, response) {
    pendingResponses.set(checkpointId, response);
}
export function getCheckpointResponse(checkpointId) {
    const response = pendingResponses.get(checkpointId);
    if (response)
        pendingResponses.delete(checkpointId);
    return response;
}
export const CheckpointTool = {
    name: "Checkpoint",
    inputSchema: null,
    outputSchema: null,
    async description() {
        return "Pause execution and wait for user input. Use this for: approval confirmations, error recovery choices (retry/skip/abort), or collecting user-provided data. The workflow will pause until the user responds.";
    },
    async call(args, context, _canUseTool, _parentMessage) {
        // The checkpoint response is stored by the permission handler.
        // The checkpointId is passed via the permission flow.
        // Try to read the response from the shared store.
        const checkpointId = args.__checkpointId;
        if (checkpointId) {
            const stored = getCheckpointResponse(checkpointId);
            if (stored) {
                return { data: stored };
            }
        }
        // No stored response and no checkpointId — this means the permission flow
        // failed to inject the checkpoint ID. Throw instead of silently auto-approving.
        throw new Error(`Checkpoint "${args.type}" has no response and no checkpointId was injected. ` +
            `The permission flow may have failed. Message: ${args.message}`);
    },
    async validateInput(input) {
        if (!input.type || !["approval", "error_choice", "data_input"].includes(input.type)) {
            return { result: false, message: "type must be 'approval', 'error_choice', or 'data_input'" };
        }
        if (!input.message || typeof input.message !== "string") {
            return { result: false, message: "message is required" };
        }
        if (input.type === "error_choice" && (!input.options || input.options.length === 0)) {
            return { result: false, message: "options are required for error_choice type" };
        }
        return { result: true };
    },
    async checkPermissions(input) {
        return {
            behavior: "ask",
            message: input.message || "Waiting for user input...",
            updatedInput: input,
        };
    },
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return false;
    },
};

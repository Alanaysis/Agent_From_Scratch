import { runAgent } from "./runAgent";
import { createSubagentContext } from "./subagentContext";
export const AgentTool = {
    name: "Agent",
    inputSchema: null,
    outputSchema: null,
    async description() {
        return "Launch a subagent";
    },
    async call(args, context, canUseTool, _parentMessage) {
        createSubagentContext(context, {
            agentType: args.subagentType,
        });
        const result = await runAgent({
            description: args.description,
            prompt: args.prompt,
            subagentType: args.subagentType,
            parentContext: context,
            canUseTool,
        });
        return {
            data: {
                status: "completed",
                result,
            },
        };
    },
    async validateInput(input) {
        if (!input.description.trim()) {
            return { result: false, message: "Description is required" };
        }
        if (!input.prompt.trim()) {
            return { result: false, message: "Prompt is required" };
        }
        return { result: true };
    },
    async checkPermissions(input, context) {
        if (context.getAppState().permissionContext.mode === "default") {
            return {
                behavior: "ask",
                message: `Agent launch requires confirmation for "${input.description}"`,
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
        return false;
    },
};

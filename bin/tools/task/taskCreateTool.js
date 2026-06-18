import { createTask } from "../../storage/taskIndex";
import { createId } from "../../shared/ids";
export const TaskCreateTool = {
    name: "TaskCreate",
    inputSchema: null,
    outputSchema: null,
    async description() {
        return "Create a new task in the task management system";
    },
    async call(args, context, _canUseTool, _parentMessage) {
        if (!args.title?.trim()) {
            throw new Error("Task title is required");
        }
        const task = await createTask(context.cwd, {
            id: createId("task"),
            title: args.title.trim(),
            description: args.description,
            status: "todo",
            priority: args.priority || "medium",
            assignee: args.assignee || "general-purpose",
            dependsOn: args.dependsOn,
        });
        return {
            data: {
                taskId: task.id,
                title: task.title,
                status: task.status,
            },
        };
    },
    async validateInput(input) {
        if (!input?.title || typeof input.title !== "string" || !input.title.trim()) {
            return { result: false, message: "Task title is required" };
        }
        return { result: true };
    },
    async checkPermissions(_input, context) {
        if (context.getAppState().permissionContext.mode === "default") {
            return {
                behavior: "ask",
                message: "Create a new task?",
            };
        }
        return { behavior: "allow", updatedInput: _input };
    },
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return true;
    },
};

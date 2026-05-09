const SERVER_URL = "http://localhost:8765";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
async function callServer(endpoint, args = [], retries = 0) {
    try {
        const isRetry = retries > 0;
        const response = await fetch(`${SERVER_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ args, retry: isRetry }),
        });
        const result = await response.json();
        if (result.status === "error" && retries < MAX_RETRIES) {
            console.log(`[RETRY ${retries + 1}/${MAX_RETRIES} for ${endpoint} due to error: ${result.message}`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return callServer(endpoint, args, retries + 1);
        }
        return result;
    }
    catch (error) {
        if (retries < MAX_RETRIES) {
            console.log(`[RETRY ${retries + 1}/${MAX_RETRIES} for ${endpoint} due to connection error`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return callServer(endpoint, args, retries + 1);
        }
        return {
            status: "error",
            message: `无法连接到 Recipe 服务器: ${error}`,
        };
    }
}
// recipe_tool
export const RecipeTool = {
    name: "recipe_tool",
    inputSchema: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "完整的recipe_tool命令，例如：-c recipe_name -p path -o down -type pattern",
            },
        },
        required: ["command"],
    },
    async description(input, context) {
        return "Recipe 工具 - 创建新配方、加载配方或管理配方页面";
    },
    async call(args) {
        const commandParts = args.command.split(/\s+/);
        const result = await callServer("/recipe_tool", commandParts);
        return {
            data: {
                message: result.message || JSON.stringify(result),
            },
        };
    },
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return false;
    },
};
// wafer_tool
export const WaferTool = {
    name: "wafer_tool",
    inputSchema: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "完整的wafer_tool命令，例如：-l 2.25",
            },
        },
        required: ["command"],
    },
    async description(input, context) {
        return "Wafer 工具 - 控制机器处理 Foup 和 Wafer";
    },
    async call(args) {
        const commandParts = args.command.split(/\s+/);
        const result = await callServer("/wafer_tool", commandParts);
        return {
            data: {
                message: result.message || JSON.stringify(result),
            },
        };
    },
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return false;
    },
};
// align_tool
export const AlignTool = {
    name: "align_tool",
    inputSchema: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "完整的align_tool命令，例如：-s low 或 -m low1",
            },
        },
        required: ["command"],
    },
    async description(input, context) {
        return "Align 工具 - Wafer 对准，包括低倍和高倍对准";
    },
    async call(args) {
        const commandParts = args.command.split(/\s+/);
        const result = await callServer("/align_tool", commandParts);
        return {
            data: {
                message: result.message || JSON.stringify(result),
            },
        };
    },
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return false;
    },
};
// image_tool
export const ImageTool = {
    name: "image_tool",
    inputSchema: {
        type: "object",
        properties: {
            times: {
                type: "number",
                description: "螺旋式图像搜索的次数",
            },
        },
    },
    async description(input, context) {
        return "Image 工具 - 自动查找特征图";
    },
    async call(args) {
        const times = args.times ? [String(args.times)] : [];
        const result = await callServer("/image_tool", times);
        return {
            data: {
                message: result.message || JSON.stringify(result),
            },
        };
    },
    isReadOnly() {
        return true;
    },
    isConcurrencySafe() {
        return true;
    },
};
// 状态检查工具
export const RecipeStatusTool = {
    name: "recipe_status",
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["status", "reset", "logs"],
                description: "获取状态、重置状态或查看调用日志",
            },
        },
        required: ["action"],
    },
    async description(input, context) {
        return "Recipe 状态工具 - 获取当前状态、重置状态或查看调用日志";
    },
    async call(args) {
        try {
            let endpoint;
            switch (args.action) {
                case "reset":
                    endpoint = "/reset";
                    break;
                case "logs":
                    endpoint = "/logs";
                    break;
                default:
                    endpoint = "/status";
            }
            const response = await fetch(`${SERVER_URL}${endpoint}`, {
                method: "GET",
            });
            const result = await response.json();
            let message;
            if (args.action === "reset") {
                message = "状态已重置";
            }
            else if (args.action === "logs") {
                const logs = result.data || [];
                message = `调用日志 (${logs.length} 条):\n${logs.map((log) => `[${log.timestamp}] ${log.endpoint} ${log.success ? '✓' : '✗'}${log.retry ? ' (RETRY)' : ''}\n  Args: ${JSON.stringify(log.args)}\n  Result: ${log.result.message || JSON.stringify(log.result)}`).join('\n\n')}`;
            }
            else {
                message = `当前状态: ${JSON.stringify(result.data, null, 2)}`;
            }
            return {
                data: {
                    message,
                },
            };
        }
        catch (error) {
            return {
                data: {
                    message: `无法连接到 Recipe 服务器: ${error}`,
                },
            };
        }
    },
    isReadOnly(input) {
        return input.action !== "reset";
    },
    isConcurrencySafe() {
        return true;
    },
};

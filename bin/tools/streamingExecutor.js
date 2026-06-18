import { eventBus } from "../shared/eventBus";
import { logToolStart, logToolResult, logToolException } from "../shared/toolLogger";
import { executeBeforeHooks, executeAfterHooks } from "./hooks";
export async function executeWithInstrumentation(options) {
    const { tool, input: originalInput, context, canUseTool, parentMessage, toolUseId, sessionId } = options;
    const sid = sessionId || "";
    const startTime = Date.now();
    // Build hook context
    const hookCtx = {
        toolName: tool.name,
        input: originalInput,
        context,
        sessionId: sid,
        toolUseId,
        timestamp: startTime,
    };
    // Execute before hooks (can block or modify input)
    const beforeResult = await executeBeforeHooks(hookCtx);
    if (!beforeResult.proceed) {
        const durationMs = Date.now() - startTime;
        const reason = beforeResult.reason || "Blocked by hook";
        eventBus.emit("tool:error", {
            sessionId: sid,
            toolUseId,
            toolName: tool.name,
            error: reason,
            durationMs,
            timestamp: Date.now(),
        });
        throw new Error(`Tool blocked by hook: ${reason}`);
    }
    // Use modified input if hook provided one
    const input = beforeResult.modifiedInput !== undefined
        ? beforeResult.modifiedInput
        : originalInput;
    eventBus.emit("tool:start", {
        sessionId: sid,
        toolUseId,
        toolName: tool.name,
        input,
        timestamp: startTime,
    });
    logToolStart(tool.name, toolUseId, input);
    try {
        const onProgress = (progress) => {
            eventBus.emit("tool:progress", {
                sessionId: sid,
                toolUseId,
                toolName: tool.name,
                progress,
                timestamp: Date.now(),
            });
        };
        let result = await tool.call(input, context, canUseTool, parentMessage, onProgress);
        const durationMs = Date.now() - startTime;
        // Execute after hooks (can transform result)
        const afterResult = await executeAfterHooks(hookCtx, result.data);
        if (afterResult.replaceResult && afterResult.newResult !== undefined) {
            result = { ...result, data: afterResult.newResult };
        }
        eventBus.emit("tool:result", {
            sessionId: sid,
            toolUseId,
            toolName: tool.name,
            durationMs,
            isError: false,
            result: typeof result.data === "string" ? result.data.slice(0, 500) : undefined,
            timestamp: Date.now(),
        });
        logToolResult(tool.name, toolUseId, durationMs, result.data);
        return { data: result.data, durationMs };
    }
    catch (error) {
        const durationMs = Date.now() - startTime;
        const message = error instanceof Error ? error.message : String(error);
        logToolException(tool.name, toolUseId, durationMs, error);
        // Execute after hooks with error (for logging/knowledge extraction)
        await executeAfterHooks(hookCtx, undefined, error instanceof Error ? error : new Error(message));
        eventBus.emit("tool:error", {
            sessionId: sid,
            toolUseId,
            toolName: tool.name,
            error: message,
            durationMs,
            timestamp: Date.now(),
        });
        throw error;
    }
}

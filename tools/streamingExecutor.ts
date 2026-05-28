import { eventBus } from "../shared/eventBus";
import { logToolStart, logToolResult, logToolException } from "../shared/toolLogger";
import type { Tool, ToolUseContext, CanUseToolFn } from "./Tool";
import type { AssistantMessage } from "../runtime/messages";

export interface ExecuteOptions<Input, Output> {
  tool: Tool<Input, Output>;
  input: Input;
  context: ToolUseContext;
  canUseTool: CanUseToolFn;
  parentMessage: AssistantMessage;
  toolUseId: string;
  sessionId?: string;
}

export interface ExecuteResult<Output> {
  data: Output;
  durationMs: number;
}

export async function executeWithInstrumentation<Input, Output>(
  options: ExecuteOptions<Input, Output>,
): Promise<ExecuteResult<Output>> {
  const { tool, input, context, canUseTool, parentMessage, toolUseId, sessionId } = options;
  const sid = sessionId || "";
  const startTime = Date.now();

  eventBus.emit("tool:start", {
    sessionId: sid,
    toolUseId,
    toolName: tool.name,
    input,
    timestamp: startTime,
  });
  logToolStart(tool.name, toolUseId, input);

  try {
    const onProgress = (progress: unknown) => {
      eventBus.emit("tool:progress", {
        sessionId: sid,
        toolUseId,
        toolName: tool.name,
        progress,
        timestamp: Date.now(),
      });
    };

    const result = await tool.call(input, context, canUseTool, parentMessage, onProgress);
    const durationMs = Date.now() - startTime;

    eventBus.emit("tool:result", {
      sessionId: sid,
      toolUseId,
      toolName: tool.name,
      durationMs,
      isError: false,
      result:
        typeof result.data === "string" ? result.data.slice(0, 500) : undefined,
      timestamp: Date.now(),
    });
    logToolResult(tool.name, toolUseId, durationMs, result.data);

    return { data: result.data, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logToolException(tool.name, toolUseId, durationMs, error);

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

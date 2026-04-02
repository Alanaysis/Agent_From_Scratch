import type { ToolUseContext } from "../Tool";
import { createId } from "../../shared/ids";

export type SubagentContextOverrides = {
  agentId?: string;
  agentType?: string;
  messages?: ToolUseContext["messages"];
  abortController?: AbortController;
  shareAbortController?: boolean;
  shareSetAppState?: boolean;
};

export function createSubagentContext(
  parent: ToolUseContext,
  overrides?: SubagentContextOverrides,
): ToolUseContext {
  return {
    ...parent,
    messages: overrides?.messages ?? parent.messages,
    agentId: overrides?.agentId ?? parent.agentId ?? createId("agent"),
    agentType: overrides?.agentType,
    abortController:
      overrides?.abortController ??
      (overrides?.shareAbortController
        ? parent.abortController
        : new AbortController()),
    setAppState: overrides?.shareSetAppState ? parent.setAppState : () => {},
  };
}

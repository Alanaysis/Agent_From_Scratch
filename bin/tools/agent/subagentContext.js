import { createId } from "../../shared/ids";
export function createSubagentContext(parent, overrides) {
    return {
        ...parent,
        messages: overrides?.messages ?? parent.messages,
        agentId: overrides?.agentId ?? parent.agentId ?? createId("agent"),
        agentType: overrides?.agentType,
        abortController: overrides?.abortController ??
            (overrides?.shareAbortController
                ? parent.abortController
                : new AbortController()),
        setAppState: overrides?.shareSetAppState ? parent.setAppState : () => { },
    };
}

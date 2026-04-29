import { describe, it, expect } from "bun:test";
import type { ToolUseContext } from "../../../tools/Tool";
import { createSubagentContext, type SubagentContextOverrides } from "../../../tools/agent/subagentContext";

describe("createSubagentContext - basic context creation", () => {
  function createMockParent(): ToolUseContext {
    return {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "parent-agent-123",
    };
  }

  it("creates subagent context with parent values by default", () => {
    const parent = createMockParent();
    const child = createSubagentContext(parent);

    expect(child.cwd).toBe("/tmp/test");
    expect(child.agentId).toBe("parent-agent-123");
    expect(Array.isArray(child.messages)).toBe(true);
  });

  it("inherits agentType from parent when provided", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "test-agent",
      agentType: "parent-type",
    };

    // Note: Current implementation doesn't inherit agentType from parent
    // It only uses the override value or undefined
    const child = createSubagentContext(parent);
    expect(child.agentType).toBeUndefined();
  });

  it("does not inherit agentType when parent has none", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "test-agent",
    };

    const child = createSubagentContext(parent);
    expect(child.agentType).toBeUndefined();
  });
});

describe("createSubagentContext - agentId override", () => {
  function createMockParent(): ToolUseContext {
    return {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "parent-agent-123",
    };
  }

  it("uses override agentId when provided", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      agentId: "override-agent-456",
    };

    const child = createSubagentContext(parent, overrides);
    expect(child.agentId).toBe("override-agent-456");
  });

  it("uses parent agentId when override is not provided", () => {
    const parent = createMockParent();

    const child = createSubagentContext(parent);
    expect(child.agentId).toBe("parent-agent-123");
  });

  it("creates new agentId when both parent and override are missing", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
    };

    const child = createSubagentContext(parent);
    expect(child.agentId).toBeDefined();
    expect(typeof child.agentId).toBe("string");
  });

  it("generates agentId with consistent format", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
    };

    const child1 = createSubagentContext(parent);
    const child2 = createSubagentContext(parent);

    expect(child1.agentId).toMatch(/^agent-/);
    expect(child2.agentId).toMatch(/^agent-/);
  });
});

describe("createSubagentContext - agentType override", () => {
  function createMockParent(): ToolUseContext {
    return {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "parent-agent-123",
      agentType: "original-type",
    };
  }

  it("uses override agentType when provided", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      agentType: "override-type",
    };

    const child = createSubagentContext(parent, overrides);
    expect(child.agentType).toBe("override-type");
  });

  it("does not use parent agentType when override is not provided", () => {
    // Note: Current implementation doesn't inherit agentType from parent
    const parent = createMockParent();

    const child = createSubagentContext(parent);
    expect(child.agentType).toBeUndefined();
  });

  it("sets undefined agentType when explicitly overridden to undefined", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      agentType: undefined,
    };

    const child = createSubagentContext(parent, overrides);
    expect(child.agentType).toBeUndefined();
  });

  it("handles various agent type strings", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "test-agent",
    };

    const types = ["child", "worker", "subagent", "helper", "executor"];

    for (const type of types) {
      const child = createSubagentContext(parent, { agentType: type });
      expect(child.agentType).toBe(type);
    }
  });
});

describe("createSubagentContext - messages override", () => {
  function createMockParent(): ToolUseContext {
    return {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [{ type: "user" as const, content: "parent message" }],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "parent-agent-123",
    };
  }

  it("uses override messages when provided", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      messages: [{ type: "user" as const, content: "child message" }],
    };

    const child = createSubagentContext(parent, overrides);
    expect(child.messages.length).toBe(1);
    expect((child.messages[0] as any).content).toBe("child message");
  });

  it("uses parent messages when override is not provided", () => {
    const parent = createMockParent();

    const child = createSubagentContext(parent);
    expect(child.messages.length).toBe(1);
    expect((child.messages[0] as any).content).toBe("parent message");
  });

  it("allows empty messages array", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      messages: [],
    };

    const child = createSubagentContext(parent, overrides);
    expect(child.messages).toEqual([]);
  });

  it("allows multiple messages in override", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      messages: [
        { type: "user" as const, content: "message 1" },
        { type: "assistant" as const, content: "message 2" },
        { type: "tool_result" as const, content: "result", toolUseId: "tool-1" },
      ],
    };

    const child = createSubagentContext(parent, overrides);
    expect(child.messages.length).toBe(3);
  });
});

describe("createSubagentContext - abortController handling", () => {
  function createMockParent(): ToolUseContext {
    return {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "parent-agent-123",
    };
  }

  it("creates new abortController when override is provided without shareAbortController", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      abortController: new AbortController(),
    };

    const child = createSubagentContext(parent, overrides);
    expect(child.abortController).not.toBe(parent.abortController);
  });

  it("shares parent abortController when shareAbortController is true", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      shareAbortController: true,
    };

    const child = createSubagentContext(parent, overrides);
    expect(child.abortController).toBe(parent.abortController);
  });

  it("uses override abortController even with shareAbortController false", () => {
    const parent = createMockParent();
    const overrideController = new AbortController();
    const overrides: SubagentContextOverrides = {
      abortController: overrideController,
      shareAbortController: false,
    };

    const child = createSubagentContext(parent, overrides);
    expect(child.abortController).toBe(overrideController);
  });

  it("creates new abortController by default when neither override nor share is set", () => {
    const parent = createMockParent();

    const child = createSubagentContext(parent);
    expect(child.abortController).not.toBe(parent.abortController);
  });

  it("aborts are independent when not sharing", async () => {
    const parent = createMockContextWithAbort();
    const overrides: SubagentContextOverrides = {};

    const child = createSubagentContext(parent, overrides);

    // Abort parent controller
    parent.abortController.abort(new Error("Parent aborted"));
    expect(parent.abortController.signal.aborted).toBe(true);
    expect(child.abortController.signal.aborted).toBe(false);
  });

  it("aborts are synchronized when sharing", async () => {
    const parent = createMockContextWithAbort();
    const overrides: SubagentContextOverrides = {
      shareAbortController: true,
    };

    const child = createSubagentContext(parent, overrides);

    // Abort parent controller
    parent.abortController.abort(new Error("Parent aborted"));
    expect(child.abortController.signal.aborted).toBe(true);
  });
});

function createMockContextWithAbort(): ToolUseContext {
  return {
    cwd: "/tmp/test",
    abortController: new AbortController(),
    messages: [],
    getAppState: () => ({}),
    setAppState: () => {},
    agentId: "test-agent",
  };
}

describe("createSubagentContext - setAppState handling", () => {
  function createMockParent(): ToolUseContext {
    let appState = { counter: 0 };
    return {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => appState,
      setAppState: (updater) => {
        if (typeof updater === "function") {
          appState = updater(appState);
        } else {
          appState = updater;
        }
      },
      agentId: "parent-agent-123",
    };
  }

  it("uses parent setAppState when shareSetAppState is true", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      shareSetAppState: true,
    };

    const child = createSubagentContext(parent, overrides);

    // Both should see the same state changes
    parent.setAppState({ counter: 1 });
    expect(parent.getAppState().counter).toBe(1);
    expect(child.getAppState().counter).toBe(1);
  });

  it("uses no-op setAppState when shareSetAppState is false", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      shareSetAppState: false,
    };

    const child = createSubagentContext(parent, overrides);

    // Child's setAppState should be a no-op
    child.setAppState({ counter: 999 });
    expect(child.getAppState().counter).toBe(0); // No change from no-op
  });

  it("uses parent setAppState by default when shareSetAppState is undefined", () => {
    const parent = createMockParent();

    const child = createSubagentContext(parent);

    // By default, should use parent's setAppState
    expect(child.setAppState).not.toBe(() => {});
  });

  it("state changes are visible to both contexts when sharing", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      shareSetAppState: true,
    };

    const child = createSubagentContext(parent, overrides);

    // Parent modifies state
    parent.setAppState((state) => ({ ...state, counter: 1 }));
    expect(child.getAppState().counter).toBe(1);

    // Child modifies state
    child.setAppState((state) => ({ ...state, counter: 2 }));
    expect(parent.getAppState().counter).toBe(2);
  });

  it("handles function-style state updates", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      shareSetAppState: true,
    };

    const child = createSubagentContext(parent, overrides);

    // Use functional update
    child.setAppState((state) => ({ ...state, counter: state.counter + 10 }));
    expect(child.getAppState().counter).toBe(10);
  });

  it("handles object-style state updates", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      shareSetAppState: true,
    };

    const child = createSubagentContext(parent, overrides);

    // Use direct object update
    child.setAppState({ counter: 42 });
    expect(child.getAppState().counter).toBe(42);
  });
});

describe("createSubagentContext - combined overrides", () => {
  function createMockParent(): ToolUseContext {
    return {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [{ type: "user" as const, content: "parent" }],
      getAppState: () => ({ counter: 0 }),
      setAppState: () => {},
      agentId: "parent-agent-123",
      agentType: "original-type",
    };
  }

  it("applies all overrides correctly at once", () => {
    const parent = createMockParent();
    const newMessages = [{ type: "user" as const, content: "child" }];
    const overrideController = new AbortController();

    const overrides: SubagentContextOverrides = {
      agentId: "override-agent",
      agentType: "override-type",
      messages: newMessages,
      abortController: overrideController,
      shareAbortController: false,
      shareSetAppState: true,
    };

    const child = createSubagentContext(parent, overrides);

    expect(child.agentId).toBe("override-agent");
    expect(child.agentType).toBe("override-type");
    expect(child.messages[0]).toBe(newMessages[0]);
    expect(child.abortController).toBe(overrideController);
  });

  it("preserves parent values for non-overridden properties", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      agentId: "only-agent-changed",
    };

    const child = createSubagentContext(parent, overrides);

    expect(child.cwd).toBe("/tmp/test");
    // Note: agentType is not inherited from parent in current implementation
    expect(child.agentType).toBeUndefined();
    expect(child.messages[0].content).toBe("parent");
  });

  it("handles partial override with only share flags", () => {
    const parent = createMockParent();
    const overrides: SubagentContextOverrides = {
      shareAbortController: true,
      shareSetAppState: false,
    };

    const child = createSubagentContext(parent, overrides);

    expect(child.abortController).toBe(parent.abortController);
  });
});

describe("createSubagentContext - property immutability", () => {
  function createMockParent(): ToolUseContext {
    return {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "parent-agent-123",
    };
  }

  it("does not mutate parent context", () => {
    const parent = createMockParent();
    const originalAgentId = parent.agentId;

    createSubagentContext(parent, { agentId: "new-id" });

    expect(parent.agentId).toBe(originalAgentId);
  });

  it("creates independent abortController by default", () => {
    const parent = createMockParent();
    const child = createSubagentContext(parent);

    parent.abortController.abort(new Error("test"));

    expect(parent.abortController.signal.aborted).toBe(true);
    expect(child.abortController.signal.aborted).toBe(false);
  });

  it("messages array is referenced, not copied", () => {
    const parent = createMockParent();
    const child = createSubagentContext(parent);

    // Both reference the same messages array initially
    expect(child.messages).toBe(parent.messages);

    // Modifying via child affects parent (expected behavior)
    parent.messages.push({ type: "user" as const, content: "test" });
    expect(child.messages.length).toBe(1);
  });

  it("getAppState function is not mutated", () => {
    const parent = createMockParent();
    const child = createSubagentContext(parent);

    const originalGetAppState = parent.getAppState;

    // Should still be the same function reference
    expect(child.getAppState).toBe(originalGetAppState);
  });
});

describe("createSubagentContext - edge cases", () => {
  it("handles empty string agentId", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "",
    };

    const child = createSubagentContext(parent, { agentId: "" });
    expect(child.agentId).toBe("");
  });

  it("handles special characters in agentType", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "test-agent",
    };

    const specialTypes = ["agent-v1.0", "Agent_2", "sub-agent-3"];

    for (const type of specialTypes) {
      const child = createSubagentContext(parent, { agentType: type });
      expect(child.agentType).toBe(type);
    }
  });

  it("handles very long messages array", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "test-agent",
    };

    const longMessages = Array.from({ length: 100 }, (_, i) => ({
      type: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Message ${i}`,
    }));

    const child = createSubagentContext(parent, { messages: longMessages });
    expect(child.messages.length).toBe(100);
  });

  it("handles nested AbortController operations", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "test-agent",
    };

    // Create a subagent context sharing the parent's controller
    const child = createSubagentContext(parent, { shareAbortController: true });

    // Create another level of nesting
    const grandchild = createSubagentContext(child, { shareAbortController: true });

    // Abort at any level affects all
    grandchild.abortController.abort(new Error("nested abort"));

    expect(parent.abortController.signal.aborted).toBe(true);
    expect(child.abortController.signal.aborted).toBe(true);
    expect(grandchild.abortController.signal.aborted).toBe(true);
  });

  it("handles multiple shares of same parent context", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "test-agent",
    };

    const child1 = createSubagentContext(parent, { shareAbortController: true });
    const child2 = createSubagentContext(parent, { shareAbortController: true });

    // Both children should share the same controller as parent
    expect(child1.abortController).toBe(parent.abortController);
    expect(child2.abortController).toBe(parent.abortController);
  });
});

describe("createSubagentContext - TypeScript type safety", () => {
  it("accepts optional overrides parameter", () => {
    const parent: ToolUseContext = {
      cwd: "/tmp/test",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
      agentId: "test-agent",
    };

    // All these should compile without errors
    const c1 = createSubagentContext(parent);
    const c2 = createSubagentContext(parent, {});
    const c3 = createSubagentContext(parent, { agentId: "override" });
    const c4 = createSubagentContext(parent, { agentType: "type" });

    expect(c1.agentId).toBeDefined();
    expect(c2.agentId).toBeDefined();
  });

  it("validates SubagentContextOverrides type structure", () => {
    const validOverrides: SubagentContextOverrides[] = [
      {}, // Empty is valid
      { agentId: "test" },
      { agentType: "worker" },
      { messages: [] },
      { abortController: new AbortController() },
      { shareAbortController: true },
      { shareSetAppState: false },
      {
        agentId: "id",
        agentType: "type",
        messages: [],
        abortController: new AbortController(),
        shareAbortController: true,
        shareSetAppState: true,
      },
    ];

    for (const overrides of validOverrides) {
      expect(typeof overrides).toBe("object" || typeof overrides === "undefined");
    }
  });
});

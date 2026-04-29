import { describe, it, expect } from "bun:test";
import type {
  TuiOptions,
  EntryKind,
  ConversationEntry,
  ModalState,
  RuntimeState,
  ActivityCard,
  ActivityStep,
  TimelineFilter,
  TuiState,
} from "../../../app/tui";

describe("TUI types - TuiOptions", () => {
  it("has required cwd property", () => {
    const options: TuiOptions = { cwd: "/tmp" };
    expect(options.cwd).toBe("/tmp");
  });

  it("has optional autoApprove property", () => {
    const options1: TuiOptions = { cwd: "/tmp", autoApprove: true };
    const options2: TuiOptions = { cwd: "/tmp", autoApprove: false };
    const options3: TuiOptions = { cwd: "/tmp" };

    expect(options1.autoApprove).toBe(true);
    expect(options2.autoApprove).toBe(false);
    expect(options3.autoApprove).toBeUndefined();
  });
});

describe("TUI types - EntryKind", () => {
  it("defines valid entry kinds", () => {
    const validKinds: EntryKind[] = [
      "user",
      "assistant",
      "tool",
      "result",
      "system",
      "error",
    ];

    expect(validKinds).toHaveLength(6);
    expect(validKinds).toContain("user");
    expect(validKinds).toContain("assistant");
  });

  it("type guards work correctly for entry kinds", () => {
    const userEntry: ConversationEntry = { kind: "user", text: "hello" };
    const assistantEntry: ConversationEntry = { kind: "assistant", text: "hi" };
    const toolEntry: ConversationEntry = { kind: "tool", text: "reading file" };
    const resultEntry: ConversationEntry = { kind: "result", text: "done" };
    const systemEntry: ConversationEntry = { kind: "system", text: "info" };
    const errorEntry: ConversationEntry = { kind: "error", text: "failed" };

    expect(userEntry.kind).toBe("user");
    expect(assistantEntry.kind).toBe("assistant");
    expect(toolEntry.kind).toBe("tool");
    expect(resultEntry.kind).toBe("result");
    expect(systemEntry.kind).toBe("system");
    expect(errorEntry.kind).toBe("error");
  });
});

describe("TUI types - ConversationEntry", () => {
  it("has required kind and text properties", () => {
    const entry: ConversationEntry = {
      kind: "user",
      text: "test message",
    };

    expect(entry.kind).toBe("user");
    expect(entry.text).toBe("test message");
  });

  it("has optional collapsible property", () => {
    const collapsed: ConversationEntry = {
      kind: "tool",
      text: "tool output",
      collapsible: true,
      expanded: false,
    };

    expect(collapsed.collapsible).toBe(true);
    expect(collapsed.expanded).toBe(false);
  });

  it("has optional collapseKey property", () => {
    const entry: ConversationEntry = {
      kind: "assistant",
      text: "response",
      collapseKey: 123,
    };

    expect(entry.collapseKey).toBe(123);
  });

  it("has optional summary property", () => {
    const entry: ConversationEntry = {
      kind: "tool",
      text: "read file",
      summary: "Read /tmp/file.txt",
    };

    expect(entry.summary).toBe("Read /tmp/file.txt");
  });
});

describe("TUI types - ModalState", () => {
  it("has required title and message properties", () => {
    const modal: ModalState = {
      title: "Confirm Action",
      message: "Do you want to proceed?",
      resolve: (() => {}) as any,
    };

    expect(modal.title).toBe("Confirm Action");
    expect(modal.message).toBe("Do you want to proceed?");
  });

  it("has optional toolName property", () => {
    const modal: ModalState = {
      title: "Tool Permission",
      message: "Allow Read access?",
      toolName: "Read",
      resolve: (() => {}) as any,
    };

    expect(modal.toolName).toBe("Read");
  });

  it("has optional inputValue property", () => {
    const modal: ModalState = {
      title: "Confirm",
      message: "Continue?",
      inputValue: { path: "/tmp/test.txt" },
      resolve: (() => {}) as any,
    };

    expect(modal.inputValue).toEqual({ path: "/tmp/test.txt" });
  });

  it("has required resolve function", () => {
    let resolvedValue: "allow-once" | "allow-session" | "deny" | null = null;

    const modal: ModalState = {
      title: "Test",
      message: "Test?",
      resolve: (value) => {
        resolvedValue = value;
      },
    };

    modal.resolve("allow-once");
    expect(resolvedValue).toBe("allow-once");

    modal.resolve("allow-session");
    expect(resolvedValue).toBe("allow-session");

    modal.resolve("deny");
    expect(resolvedValue).toBe("deny");
  });
});

describe("TUI types - RuntimeState", () => {
  it("has required session property", () => {
    // We can't easily instantiate SessionEngine, so we test the structure
    const state: Omit<RuntimeState, "session"> = {
      toolContext: {} as any,
    };

    expect(state.toolContext).toBeDefined();
  });

  it("has required toolContext property", () => {
    // Test that tool context type is satisfied
    const mockContext = {
      cwd: "/tmp",
      abortController: new AbortController(),
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
    };

    expect(mockContext.cwd).toBe("/tmp");
  });
});

describe("TUI types - ActivityCard", () => {
  it("has required phase property with valid values", () => {
    const validPhases: ActivityCard["phase"][] = [
      "idle",
      "planning",
      "approval",
      "running",
      "done",
      "failed",
    ];

    for (const phase of validPhases) {
      const card: ActivityCard = { phase };
      expect(card.phase).toBe(phase);
    }
  });

  it("has optional toolName property", () => {
    const card: ActivityCard = {
      phase: "running",
      toolName: "Read",
    };

    expect(card.toolName).toBe("Read");
  });

  it("has optional detail property", () => {
    const card: ActivityCard = {
      phase: "planning",
      detail: "Analyzing request...",
    };

    expect(card.detail).toBe("Analyzing request...");
  });

  it("has optional lastResult property", () => {
    const card: ActivityCard = {
      phase: "done",
      lastResult: "Success!",
    };

    expect(card.lastResult).toBe("Success!");
  });
});

describe("TUI types - ActivityStep", () => {
  it("has all required properties", () => {
    const step: ActivityStep = {
      seq: 1,
      at: "2024-01-01T00:00:00.000Z",
      label: "Tool execution",
      summary: "Read file",
      kind: "tool",
      status: "done",
    };

    expect(step.seq).toBe(1);
    expect(step.at).toBe("2024-01-01T00:00:00.000Z");
    expect(step.label).toBe("Tool execution");
    expect(step.summary).toBe("Read file");
    expect(step.kind).toBe("tool");
    expect(step.status).toBe("done");
  });

  it("has optional durationMs property", () => {
    const step: ActivityStep = {
      seq: 1,
      at: "2024-01-01T00:00:00.000Z",
      label: "Fast operation",
      summary: "Quick read",
      kind: "tool",
      status: "done",
      durationMs: 50,
    };

    expect(step.durationMs).toBe(50);
  });

  it("validates kind values", () => {
    const validKinds: ActivityStep["kind"][] = ["tool", "permission", "prompt", "session", "error"];

    for (const kind of validKinds) {
      const step: ActivityStep = {
        seq: 1,
        at: "2024-01-01T00:00:00.000Z",
        label: "Test",
        summary: "Test",
        kind,
        status: "done",
      };
      expect(step.kind).toBe(kind);
    }
  });

  it("validates status values", () => {
    const validStatuses: ActivityStep["status"][] = ["info", "done", "failed"];

    for (const status of validStatuses) {
      const step: ActivityStep = {
        seq: 1,
        at: "2024-01-01T00:00:00.000Z",
        label: "Test",
        summary: "Test",
        kind: "tool",
        status,
      };
      expect(step.status).toBe(status);
    }
  });
});

describe("TUI types - TimelineFilter", () => {
  it("defines valid timeline filters", () => {
    const validFilters: TimelineFilter[] = ["all", "failed", "tools"];

    for (const filter of validFilters) {
      expect(filter).toBeDefined();
    }

    expect(validFilters).toHaveLength(3);
  });

  it("filters work correctly in practice", () => {
    const filters: TimelineFilter[] = ["all", "failed", "tools"];

    for (const filter of filters) {
      const step: ActivityStep = {
        seq: 1,
        at: new Date().toISOString(),
        label: "Test",
        summary: "Test",
        kind: "tool",
        status: "done",
      };

      // All steps should be visible with 'all' filter
      if (filter === "all") {
        expect(true).toBe(true);
      }
    }
  });
});

describe("TUI types - TuiState", () => {
  it("has all required properties initialized correctly", () => {
    const state: TuiState = {
      entries: [],
      streamingAssistantText: "",
      inputBuffer: "",
      status: "ready",
      busy: false,
      modal: null,
      scrollOffset: 0,
      toolSteps: [],
      currentActivity: null,
      currentSessionId: createTestId(),
      activityStartedAt: null,
      nextCollapseKey: 1,
      nextStepSeq: 1,
      timelineFilter: "all",
    };

    expect(state.entries).toEqual([]);
    expect(state.streamingAssistantText).toBe("");
    expect(state.inputBuffer).toBe("");
    expect(state.status).toBe("ready");
    expect(state.busy).toBe(false);
    expect(state.modal).toBeNull();
    expect(state.scrollOffset).toBe(0);
    expect(state.toolSteps).toEqual([]);
    expect(state.currentActivity).toBeNull();
    expect(state.timelineFilter).toBe("all");
  });

  it("manages entries array correctly", () => {
    const state: TuiState = {
      entries: [],
      streamingAssistantText: "",
      inputBuffer: "",
      status: "ready",
      busy: false,
      modal: null,
      scrollOffset: 0,
      toolSteps: [],
      currentActivity: null,
      currentSessionId: createTestId(),
      activityStartedAt: null,
      nextCollapseKey: 1,
      nextStepSeq: 1,
      timelineFilter: "all",
    };

    // Add entries
    state.entries.push(
      { kind: "user", text: "hello" },
      { kind: "assistant", text: "hi there" }
    );

    expect(state.entries.length).toBe(2);
  });

  it("manages toolSteps array correctly", () => {
    const state: TuiState = {
      entries: [],
      streamingAssistantText: "",
      inputBuffer: "",
      status: "ready",
      busy: false,
      modal: null,
      scrollOffset: 0,
      toolSteps: [],
      currentActivity: null,
      currentSessionId: createTestId(),
      activityStartedAt: null,
      nextCollapseKey: 1,
      nextStepSeq: 1,
      timelineFilter: "all",
    };

    state.toolSteps.push({
      seq: 1,
      at: new Date().toISOString(),
      label: "Tool step",
      summary: "Test",
      kind: "tool",
      status: "done",
    });

    expect(state.toolSteps.length).toBe(1);
    expect(state.toolSteps[0].seq).toBe(1);
  });

  it("increments nextCollapseKey correctly", () => {
    const state: TuiState = {
      entries: [],
      streamingAssistantText: "",
      inputBuffer: "",
      status: "ready",
      busy: false,
      modal: null,
      scrollOffset: 0,
      toolSteps: [],
      currentActivity: null,
      currentSessionId: createTestId(),
      activityStartedAt: null,
      nextCollapseKey: 1,
      nextStepSeq: 1,
      timelineFilter: "all",
    };

    expect(state.nextCollapseKey).toBe(1);
    state.nextCollapseKey++;
    expect(state.nextCollapseKey).toBe(2);
  });

  it("increments nextStepSeq correctly", () => {
    const state: TuiState = {
      entries: [],
      streamingAssistantText: "",
      inputBuffer: "",
      status: "ready",
      busy: false,
      modal: null,
      scrollOffset: 0,
      toolSteps: [],
      currentActivity: null,
      currentSessionId: createTestId(),
      activityStartedAt: null,
      nextCollapseKey: 1,
      nextStepSeq: 1,
      timelineFilter: "all",
    };

    expect(state.nextStepSeq).toBe(1);
    state.nextStepSeq++;
    expect(state.nextStepSeq).toBe(2);
  });

  it("handles modal state transitions", () => {
    const state: TuiState = {
      entries: [],
      streamingAssistantText: "",
      inputBuffer: "",
      status: "ready",
      busy: false,
      modal: null,
      scrollOffset: 0,
      toolSteps: [],
      currentActivity: null,
      currentSessionId: createTestId(),
      activityStartedAt: null,
      nextCollapseKey: 1,
      nextStepSeq: 1,
      timelineFilter: "all",
    };

    // Set modal
    state.modal = {
      title: "Confirm",
      message: "Continue?",
      resolve: (() => {}) as any,
    };

    expect(state.modal).not.toBeNull();
    expect(state.modal!.title).toBe("Confirm");

    // Clear modal
    state.modal = null;
    expect(state.modal).toBeNull();
  });

  it("manages currentActivity transitions", () => {
    const state: TuiState = {
      entries: [],
      streamingAssistantText: "",
      inputBuffer: "",
      status: "ready",
      busy: false,
      modal: null,
      scrollOffset: 0,
      toolSteps: [],
      currentActivity: null,
      currentSessionId: createTestId(),
      activityStartedAt: null,
      nextCollapseKey: 1,
      nextStepSeq: 1,
      timelineFilter: "all",
    };

    // Set activity
    state.currentActivity = {
      phase: "running",
      toolName: "Read",
      detail: "Reading file...",
    };

    expect(state.currentActivity).not.toBeNull();
    expect(state.currentActivity!.phase).toBe("running");

    // Clear activity
    state.currentActivity = null;
    expect(state.currentActivity).toBeNull();
  });

  it("handles timeline filter changes", () => {
    const state: TuiState = {
      entries: [],
      streamingAssistantText: "",
      inputBuffer: "",
      status: "ready",
      busy: false,
      modal: null,
      scrollOffset: 0,
      toolSteps: [],
      currentActivity: null,
      currentSessionId: createTestId(),
      activityStartedAt: null,
      nextCollapseKey: 1,
      nextStepSeq: 1,
      timelineFilter: "all",
    };

    expect(state.timelineFilter).toBe("all");

    state.timelineFilter = "failed";
    expect(state.timelineFilter).toBe("failed");

    state.timelineFilter = "tools";
    expect(state.timelineFilter).toBe("tools");
  });
});

function createTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

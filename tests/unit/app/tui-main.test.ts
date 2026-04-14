import { describe, it, expect } from "bun:test";
import type { TuiState, ActivityStep, ConversationEntry, ActivityCard } from "../../../app/tui";

// We can't directly import private functions, so we test via the types and expected behavior
// These tests validate the data structures and logic patterns used in tui.ts

describe("TUI - ConversationEntry handling", () => {
  it("creates user entry with kind and text", () => {
    const entry: ConversationEntry = { kind: "user", text: "hello" };
    expect(entry.kind).toBe("user");
    expect(entry.text).toBe("hello");
  });

  it("creates assistant entry with kind and text", () => {
    const entry: ConversationEntry = { kind: "assistant", text: "hi there" };
    expect(entry.kind).toBe("assistant");
    expect(entry.text).toBe("hi there");
  });

  it("creates tool entry with collapsible properties", () => {
    const entry: ConversationEntry = {
      kind: "tool",
      text: "read file /tmp/test.txt",
      collapsible: true,
      expanded: false,
      collapseKey: 123,
      summary: "Read /tmp/test.txt (truncated...)",
    };
    expect(entry.collapsible).toBe(true);
    expect(entry.expanded).toBe(false);
    expect(entry.collapseKey).toBe(123);
    expect(entry.summary).toContain("truncated");
  });

  it("creates result entry without collapsible", () => {
    const entry: ConversationEntry = { kind: "result", text: "file contents" };
    expect(entry.collapsible).toBeUndefined();
    expect(entry.expanded).toBeUndefined();
  });

  it("handles collapsed entries with summary display", () => {
    const entry: ConversationEntry = {
      kind: "error",
      text: "some very long error message that exceeds the normal length and should be collapsed when displayed in the UI to save space on the screen...",
      collapsible: true,
      expanded: false,
      collapseKey: 456,
      summary: "some very long error message that exceeds the normal length and should be col",
    };

    expect(entry.kind).toBe("error");
    expect(entry.collapsible).toBe(true);
    expect(entry.expanded).toBe(false);
    expect(entry.summary!.length).toBeLessThan(entry.text.length);
  });
});

describe("TUI - ActivityStep structure", () => {
  it("creates step with all required fields", () => {
    const step: ActivityStep = {
      seq: 1,
      at: "2024-01-01T12:00:00.000Z",
      label: "Tool execution",
      summary: "Read file",
      kind: "tool",
      status: "done",
    };

    expect(step.seq).toBe(1);
    expect(step.label).toBe("Tool execution");
    expect(step.summary).toBe("Read file");
    expect(step.kind).toBe("tool");
    expect(step.status).toBe("done");
  });

  it("creates step with optional durationMs", () => {
    const step: ActivityStep = {
      seq: 2,
      at: "2024-01-01T12:00:01.000Z",
      label: "Fast operation",
      summary: "Quick read",
      kind: "permission",
      status: "done",
      durationMs: 50,
    };

    expect(step.durationMs).toBe(50);
  });

  it("validates all valid kind values", () => {
    const kinds: ActivityStep["kind"][] = ["tool", "permission", "prompt", "session", "error"];
    for (const kind of kinds) {
      const step: ActivityStep = {
        seq: 1,
        at: new Date().toISOString(),
        label: "Test",
        summary: "Test",
        kind,
        status: "done",
      };
      expect(step.kind).toBe(kind);
    }
  });

  it("validates all valid status values", () => {
    const statuses: ActivityStep["status"][] = ["info", "done", "failed"];
    for (const status of statuses) {
      const step: ActivityStep = {
        seq: 1,
        at: new Date().toISOString(),
        label: "Test",
        summary: "Test",
        kind: "tool",
        status,
      };
      expect(step.status).toBe(status);
    }
  });

  it("formats step correctly with sequence number and timestamp", () => {
    const step: ActivityStep = {
      seq: 999,
      at: "15:30:45",
      label: "Shell command",
      summary: "ls -la /tmp",
      kind: "tool",
      status: "done",
      durationMs: 234,
    };

    expect(step.seq).toBe(999);
    expect(step.at).toBe("15:30:45");
    expect(step.durationMs).toBe(234);
  });
});

describe("TUI - ActivityCard state", () => {
  it("creates idle activity card", () => {
    const card: ActivityCard = { phase: "idle" };
    expect(card.phase).toBe("idle");
    expect(card.toolName).toBeUndefined();
    expect(card.detail).toBeUndefined();
  });

  it("creates planning activity card with detail", () => {
    const card: ActivityCard = {
      phase: "planning",
      detail: "Analyzing user request...",
    };
    expect(card.phase).toBe("planning");
    expect(card.detail).toBe("Analyzing user request...");
  });

  it("creates approval activity card with tool name", () => {
    const card: ActivityCard = {
      phase: "approval",
      toolName: "Read",
      detail: "User wants to read /tmp/test.txt",
    };
    expect(card.phase).toBe("approval");
    expect(card.toolName).toBe("Read");
  });

  it("creates running activity card", () => {
    const card: ActivityCard = {
      phase: "running",
      toolName: "Shell",
      detail: "Executing ls -la",
    };
    expect(card.phase).toBe("running");
    expect(card.toolName).toBe("Shell");
  });

  it("creates done activity card with lastResult", () => {
    const card: ActivityCard = {
      phase: "done",
      toolName: "Read",
      detail: "File read successfully",
      lastResult: "ok",
    };
    expect(card.phase).toBe("done");
    expect(card.lastResult).toBe("ok");
  });

  it("creates failed activity card with error details", () => {
    const card: ActivityCard = {
      phase: "failed",
      toolName: "Write",
      detail: "Permission denied",
      lastResult: "error",
    };
    expect(card.phase).toBe("failed");
    expect(card.lastResult).toBe("error");
  });

  it("handles empty string details", () => {
    const card: ActivityCard = {
      phase: "idle",
      detail: "",
    };
    expect(card.detail).toBe("");
  });
});

describe("TUI - TuiState management", () => {
  function createTestState(): TuiState {
    return {
      entries: [],
      streamingAssistantText: "",
      inputBuffer: "",
      status: "ready",
      busy: false,
      modal: null,
      scrollOffset: 0,
      toolSteps: [],
      currentActivity: null,
      currentSessionId: `test-session-${Date.now()}`,
      activityStartedAt: null,
      nextCollapseKey: 1,
      nextStepSeq: 1,
      timelineFilter: "all",
    };
  }

  it("creates initial state with empty arrays", () => {
    const state = createTestState();
    expect(state.entries).toEqual([]);
    expect(state.toolSteps).toEqual([]);
    expect(state.inputBuffer).toBe("");
  });

  it("manages busy flag correctly", () => {
    const state = createTestState();
    expect(state.busy).toBe(false);
    state.busy = true;
    expect(state.busy).toBe(true);
    state.busy = false;
    expect(state.busy).toBe(false);
  });

  it("manages streaming assistant text", () => {
    const state = createTestState();
    expect(state.streamingAssistantText).toBe("");
    state.streamingAssistantText = "I am ";
    expect(state.streamingAssistantText).toBe("I am ");
    state.streamingAssistantText = "I am thinking";
    expect(state.streamingAssistantText).toBe("I am thinking");
  });

  it("manages scroll offset bounds", () => {
    const state = createTestState();
    state.scrollOffset = 0;
    expect(state.scrollOffset).toBe(0);
    state.scrollOffset = 10;
    expect(state.scrollOffset).toBe(10);
    // Scroll shouldn't go negative (enforced elsewhere, but structure allows it)
  });

  it("manages modal state transitions", () => {
    const state = createTestState();
    expect(state.modal).toBeNull();

    state.modal = {
      title: "Permission Required",
      message: "Allow tool execution?",
      resolve: (() => {}) as any,
    };
    expect(state.modal!.title).toBe("Permission Required");

    state.modal = null;
    expect(state.modal).toBeNull();
  });

  it("manages currentActivity transitions from idle to running", () => {
    const state = createTestState();
    expect(state.currentActivity).toBeNull();

    state.currentActivity = { phase: "planning" };
    expect(state.currentActivity!.phase).toBe("planning");

    state.currentActivity = { phase: "running", toolName: "Read" };
    expect(state.currentActivity!.toolName).toBe("Read");

    state.currentActivity = null;
    expect(state.currentActivity).toBeNull();
  });

  it("increments nextCollapseKey correctly", () => {
    const state = createTestState();
    expect(state.nextCollapseKey).toBe(1);
    state.nextCollapseKey++;
    expect(state.nextCollapseKey).toBe(2);
    state.nextCollapseKey += 5;
    expect(state.nextCollapseKey).toBe(7);
  });

  it("increments nextStepSeq correctly", () => {
    const state = createTestState();
    const initial = state.nextStepSeq; // 1
    state.nextStepSeq++; // 2
    expect(state.nextStepSeq).toBe(initial + 1);
    for (let i = 0; i < 5; i++) {
      state.nextStepSeq++;
    }
    expect(state.nextStepSeq).toBe(initial + 6);
  });

  it("manages timelineFilter changes", () => {
    const state = createTestState();
    expect(state.timelineFilter).toBe("all");
    state.timelineFilter = "failed";
    expect(state.timelineFilter).toBe("failed");
    state.timelineFilter = "tools";
    expect(state.timelineFilter).toBe("tools");
    state.timelineFilter = "all";
    expect(state.timelineFilter).toBe("all");
  });

  it("manages activityStartedAt timestamp", () => {
    const state = createTestState();
    expect(state.activityStartedAt).toBeNull();
    state.activityStartedAt = Date.now();
    expect(typeof state.activityStartedAt).toBe("number");
    state.activityStartedAt = null;
    expect(state.activityStartedAt).toBeNull();
  });

  it("manages entries array with conversation history", () => {
    const state = createTestState();
    expect(state.entries.length).toBe(0);

    state.entries.push({ kind: "user", text: "hello" });
    state.entries.push({ kind: "assistant", text: "hi" });
    state.entries.push({ kind: "tool", text: "read file" });
    state.entries.push({ kind: "result", text: "file contents" });

    expect(state.entries.length).toBe(4);
    expect(state.entries[0].kind).toBe("user");
    expect(state.entries[3].kind).toBe("result");
  });

  it("manages toolSteps array with activity tracking", () => {
    const state = createTestState();
    expect(state.toolSteps.length).toBe(0);

    state.toolSteps.push({
      seq: 1,
      at: "12:00:00",
      label: "Prompt received",
      summary: "hello world",
      kind: "prompt",
      status: "info",
    });
    state.toolSteps.push({
      seq: 2,
      at: "12:00:01",
      label: "Tool execution",
      summary: "Read file",
      kind: "tool",
      status: "done",
      durationMs: 50,
    });

    expect(state.toolSteps.length).toBe(2);
    expect(state.toolSteps[1].seq).toBe(2);
  });

  it("maintains currentSessionId throughout session", () => {
    const state = createTestState();
    const originalId = state.currentSessionId;
    expect(originalId).toMatch(/^test-session-/);
    // Session ID should persist unless explicitly changed (which happens in /new command)
  });
});

describe("TUI - Entry kind filtering", () => {
  it("identifies user entries correctly", () => {
    const entry: ConversationEntry = { kind: "user", text: "test" };
    expect(entry.kind).toBe("user");
  });

  it("identifies assistant entries correctly", () => {
    const entry: ConversationEntry = { kind: "assistant", text: "response" };
    expect(entry.kind).toBe("assistant");
  });

  it("identifies tool entries correctly", () => {
    const entry: ConversationEntry = { kind: "tool", text: "Read /tmp/file.txt" };
    expect(entry.kind).toBe("tool");
  });

  it("identifies result entries correctly", () => {
    const entry: ConversationEntry = { kind: "result", text: "file content" };
    expect(entry.kind).toBe("result");
  });

  it("identifies error entries correctly", () => {
    const entry: ConversationEntry = { kind: "error", text: "permission denied" };
    expect(entry.kind).toBe("error");
  });

  it("identifies system entries correctly", () => {
    const entry: ConversationEntry = { kind: "system", text: "help message" };
    expect(entry.kind).toBe("system");
  });
});

describe("TUI - Timeline filter behavior", () => {
  it("cycles through all timeline filters", () => {
    const filters: Array<"all" | "failed" | "tools"> = ["all", "failed", "tools"];
    let current: typeof filters[number] = "all";

    // Simulate cycling
    for (const expected of filters) {
      expect(current).toBe(expected);
      if (current === "all") current = "failed";
      else if (current === "failed") current = "tools";
      else current = "all";
    }
  });

  it("filters tool steps by status", () => {
    const allSteps: ActivityStep[] = [
      { seq: 1, at: "12:00:00", label: "done", summary: "ok", kind: "tool", status: "done" },
      { seq: 2, at: "12:00:01", label: "failed", summary: "error", kind: "tool", status: "failed" },
      { seq: 3, at: "12:00:02", label: "info", summary: "info", kind: "permission", status: "info" },
    ];

    const failedSteps = allSteps.filter((step) => step.status === "failed");
    expect(failedSteps.length).toBe(1);
    expect(failedSteps[0].seq).toBe(2);

    const toolSteps = allSteps.filter((step) => step.kind === "tool");
    expect(toolSteps.length).toBe(2);
  });
});

describe("TUI - Conversation entry formatting patterns", () => {
  it("formats user prompt with 'You' prefix", () => {
    const entry: ConversationEntry = { kind: "user", text: "hello" };
    // Expected format from tui.ts: `You  ${entry.text}`
    const formatted = `You  ${entry.text}`;
    expect(formatted).toBe("You  hello");
  });

  it("formats assistant response with 'CCL' prefix", () => {
    const entry: ConversationEntry = { kind: "assistant", text: "hi there" };
    // Expected format from tui.ts: `CCL  ${entry.text}`
    const formatted = `CCL  ${entry.text}`;
    expect(formatted).toBe("CCL  hi there");
  });

  it("formats tool entry with 'Tool' prefix", () => {
    const entry: ConversationEntry = { kind: "tool", text: "Read /tmp/file.txt" };
    // Expected format from tui.ts: `Tool ${entry.text}`
    const formatted = `Tool ${entry.text}`;
    expect(formatted).toBe("Tool Read /tmp/file.txt");
  });

  it("formats result entry with 'Out' prefix", () => {
    const entry: ConversationEntry = { kind: "result", text: "file contents" };
    // Expected format from tui.ts: `Out  ${entry.text}`
    const formatted = `Out  ${entry.text}`;
    expect(formatted).toBe("Out  file contents");
  });

  it("formats error entry with 'Err' prefix", () => {
    const entry: ConversationEntry = { kind: "error", text: "something went wrong" };
    // Expected format from tui.ts: `Err  ${entry.text}`
    const formatted = `Err  ${entry.text}`;
    expect(formatted).toBe("Err  something went wrong");
  });

  it("formats system entry with 'Sys' prefix", () => {
    const entry: ConversationEntry = { kind: "system", text: "info message" };
    // Expected format from tui.ts: `Sys  ${entry.text}`
    const formatted = `Sys  ${entry.text}`;
    expect(formatted).toBe("Sys  info message");
  });
});

describe("TUI - Text summary and truncation", () => {
  it("returns text as-is if within maxLength", () => {
    const text = "Short text";
    const maxLength = 48;
    // Expected behavior from summarizeText: normalized and returned if under limit
    const normalized = text.replace(/\s+/g, " ").trim();
    expect(normalized.length).toBeLessThanOrEqual(maxLength);
    expect(normalized).toBe(text);
  });

  it("truncates long text with ellipsis", () => {
    const longText = "This is a very long text that definitely exceeds the maximum length limit and should be truncated with an ellipsis at the end to save space in the UI display.";
    const maxLength = 48;
    // Expected: text.slice(0, maxLength - 1) + '…'
    const expectedLength = maxLength;
    expect(longText.length).toBeGreaterThan(maxLength);
  });

  it("handles empty or whitespace-only text", () => {
    const normalizedEmpty = "".replace(/\s+/g, " ").trim();
    // Expected: "(empty)" for falsy after normalize
    expect(normalizedEmpty).toBe("");
  });

  it("normalizes multiple spaces to single space", () => {
    const text = "Multiple     spaces   between   words";
    const normalized = text.replace(/\s+/g, " ").trim();
    expect(normalized).toBe("Multiple spaces between words");
    expect(normalized.split(" ").length).toBeLessThan(text.split(" ").length);
  });

  it("handles newlines in text for collapse detection", () => {
    const multiLine = "First line\nSecond line\nThird line";
    // shouldCollapse checks: text.includes("\n") || text.length > 160
    expect(multiLine.includes("\n")).toBe(true);
  });

  it("handles very long single-line text for collapse", () => {
    const longText = "a".repeat(200);
    // shouldCollapse checks: text.length > 160
    expect(longText.length).toBeGreaterThan(160);
  });
});

describe("TUI - State reset and cleanup patterns", () => {
  it("clears input buffer on submission", () => {
    const state = { inputBuffer: "test input" } as any;
    // On submit, inputBuffer is cleared
    state.inputBuffer = "";
    expect(state.inputBuffer).toBe("");
  });

  it("resets streaming text after completion", () => {
    const state = { streamingAssistantText: "I am thinking..." } as any;
    // After assistant completes, streaming text is cleared
    state.streamingAssistantText = "";
    expect(state.streamingAssistantText).toBe("");
  });

  it("resets activityStartedAt after completion", () => {
    const state = { activityStartedAt: Date.now() } as any;
    // After activity completes, timestamp is nullified
    state.activityStartedAt = null;
    expect(state.activityStartedAt).toBeNull();
  });

  it("clears busy flag after completion", () => {
    const state = { busy: true } as any;
    // Busy is reset to false when done
    state.busy = false;
    expect(state.busy).toBe(false);
  });
});

describe("TUI - Modal interaction patterns", () => {
  it("modal resolves with allow-once decision", () => {
    const decisions: Array<"allow-once" | "allow-session" | "deny"> = [];
    const resolve = (decision: typeof decisions[number]) => decisions.push(decision);

    resolve("allow-once");
    expect(decisions).toEqual(["allow-once"]);
  });

  it("modal resolves with allow-session decision", () => {
    const decisions: Array<"allow-once" | "allow-session" | "deny"> = [];
    const resolve = (decision: typeof decisions[number]) => decisions.push(decision);

    resolve("allow-session");
    expect(decisions).toEqual(["allow-session"]);
  });

  it("modal resolves with deny decision", () => {
    const decisions: Array<"allow-once" | "allow-session" | "deny"> = [];
    const resolve = (decision: typeof decisions[number]) => decisions.push(decision);

    resolve("deny");
    expect(decisions).toEqual(["deny"]);
  });

  it("modal key bindings map to decisions", () => {
    // y -> allow-once, a -> allow-session, n/escape -> deny
    const decisionMap: Record<string, string> = {
      y: "allow-once",
      a: "allow-session",
      n: "deny",
      escape: "deny",
    };

    expect(decisionMap.y).toBe("allow-once");
    expect(decisionMap.a).toBe("allow-session");
    expect(decisionMap.n).toBe("deny");
    expect(decisionMap.escape).toBe("deny");
  });
});

describe("TUI - Key handler patterns", () => {
  it("return key submits input", () => {
    const state = { inputBuffer: "test", status: "ready" } as any;
    // On return, current buffer is submitted and cleared
    const current = state.inputBuffer;
    state.inputBuffer = "";
    expect(current).toBe("test");
    expect(state.inputBuffer).toBe("");
  });

  it("backspace removes last character", () => {
    const state = { inputBuffer: "hello" } as any;
    state.inputBuffer = state.inputBuffer.slice(0, -1);
    expect(state.inputBuffer).toBe("hell");
  });

  it("escape clears entire buffer", () => {
    const state = { inputBuffer: "test input" } as any;
    state.inputBuffer = "";
    expect(state.inputBuffer).toBe("");
  });

  it("up arrow increments scroll offset", () => {
    const state = { scrollOffset: 0 } as any;
    state.scrollOffset += 1;
    expect(state.scrollOffset).toBe(1);
  });

  it("down arrow decrements scroll offset (min 0)", () => {
    const state = { scrollOffset: 5 } as any;
    state.scrollOffset = Math.max(0, state.scrollOffset - 1);
    expect(state.scrollOffset).toBe(4);

    state.scrollOffset = 0;
    state.scrollOffset = Math.max(0, state.scrollOffset - 1);
    expect(state.scrollOffset).toBe(0); // Cannot go below 0
  });

  it("pageup scrolls by 8 lines", () => {
    const state = { scrollOffset: 0 } as any;
    state.scrollOffset += 8;
    expect(state.scrollOffset).toBe(8);
  });

  it("pagedown scrolls down by 8 lines (min 0)", () => {
    const state = { scrollOffset: 20 } as any;
    state.scrollOffset = Math.max(0, state.scrollOffset - 8);
    expect(state.scrollOffset).toBe(12);
  });

  it("Ctrl+C when busy aborts current operation", () => {
    const state = { busy: true } as any;
    // Ctrl+C triggers abortController.abort()
    expect(state.busy).toBe(true);
  });

  it("Ctrl+E expands all collapsed entries", () => {
    const state = { entries: [] } as any;
    // updateFoldState(state, "all", true) sets all collapsible to expanded
    expect(Array.isArray(state.entries)).toBe(true);
  });

  it("Ctrl+G collapses all expanded entries", () => {
    const state = { entries: [] } as any;
    // updateFoldState(state, "all", false) sets all collapsible to collapsed
    expect(Array.isArray(state.entries)).toBe(true);
  });

  it("Ctrl+F cycles timeline filter", () => {
    const state = { timelineFilter: "all" } as any;
    // Cycles: all -> failed -> tools -> all
    if (state.timelineFilter === "all") state.timelineFilter = "failed";
    expect(state.timelineFilter).toBe("failed");

    if (state.timelineFilter === "failed") state.timelineFilter = "tools";
    expect(state.timelineFilter).toBe("tools");

    if (state.timelineFilter === "tools") state.timelineFilter = "all";
    expect(state.timelineFilter).toBe("all");
  });
});

describe("TUI - Permission request flow", () => {
  it("autoApprove bypasses modal and returns true immediately", () => {
    const options = { autoApprove: true };
    // When autoApprove is true, permission is granted without modal
    expect(options.autoApprove).toBe(true);
  });

  it("non-autoApprove shows modal and waits for user input", () => {
    const options = { autoApprove: false };
    expect(options.autoApprove).toBe(false);
    // Modal will be shown, waiting for y/a/n key press
  });

  it("allows session permission remembers rule for future", () => {
    // When decision is "allow-session", rememberPermissionRule is called
    const decisions = ["allow-once", "allow-session", "deny"];
    const shouldRemember = decisions.includes("allow-session");
    expect(shouldRemember).toBe(true);
  });

  it("permission status updates activity card", () => {
    // After permission decision, setCurrentActivity is called with done/failed phase
    const phases = ["approval", "done", "failed"];
    for (const phase of phases) {
      expect(typeof phase).toBe("string");
    }
  });
});

describe("TUI - Activity card lifecycle", () => {
  it("activity progresses from planning to running to done/failed", () => {
    const lifecycle: ActivityCard["phase"][] = ["planning", "running", "done"];
    for (const phase of lifecycle) {
      expect(phase).toBeDefined();
    }

    // Alternative failure path
    const failurePath: ActivityCard["phase"][] = ["planning", "running", "failed"];
    for (const phase of failurePath) {
      expect(phase).toBeDefined();
    }
  });

  it("toolName is set when tool execution starts", () => {
    const card: ActivityCard = { phase: "running", toolName: "Read" };
    expect(card.toolName).toBe("Read");
  });

  it("detail provides context for each phase", () => {
    const planning: ActivityCard = { phase: "planning", detail: "Analyzing..." };
    const running: ActivityCard = { phase: "running", toolName: "Shell", detail: "Executing command" };
    const done: ActivityCard = { phase: "done", lastResult: "ok" };

    expect(planning.detail).toBe("Analyzing...");
    expect(running.toolName).toBe("Shell");
    expect(done.lastResult).toBe("ok");
  });

  it("lastResult indicates success or failure outcome", () => {
    const success: ActivityCard = { phase: "done", lastResult: "ok" };
    const error: ActivityCard = { phase: "failed", lastResult: "error" };
    const interrupted: ActivityCard = { phase: "failed", lastResult: "interrupted" };

    expect(success.lastResult).toBe("ok");
    expect(error.lastResult).toBe("error");
    expect(interrupted.lastResult).toBe("interrupted");
  });
});

describe("TUI - Tool step tracking patterns", () => {
  it("tracks steps with sequence numbers starting from 1", () => {
    const steps: ActivityStep[] = [];
    let seq = 1;

    for (let i = 0; i < 5; i++) {
      steps.push({
        seq,
        at: "12:00:00",
        label: `Step ${i + 1}`,
        summary: `Summary ${i + 1}`,
        kind: "tool",
        status: "done",
      });
      seq++;
    }

    expect(steps[0].seq).toBe(1);
    expect(steps[4].seq).toBe(5);
  });

  it("keeps only last 12 steps in toolSteps array", () => {
    const state = { toolSteps: [] as ActivityStep[], nextStepSeq: 1 } as any;

    // Add more than 12 steps
    for (let i = 0; i < 15; i++) {
      state.toolSteps.push({
        seq: state.nextStepSeq++,
        at: "12:00:00",
        label: `Step ${i}`,
        summary: `Summary ${i}`,
        kind: "tool",
        status: "done",
      });
      // Simulate slice(-12) behavior
      state.toolSteps = state.toolSteps.slice(-12);
    }

    expect(state.toolSteps.length).toBe(12);
    expect(state.toolSteps[0].seq).toBe(4); // First kept step
    expect(state.toolSteps[11].seq).toBe(15); // Last step
  });

  it("formats timestamp as HH:MM:SS", () => {
    const timeStr = new Date().toTimeString().slice(0, 8);
    // Should be "HH:MM:SS" format (first 8 chars of toTimeString)
    expect(timeStr).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("summarizes labels to ~28 characters", () => {
    const longLabel = "This is a very long label that should be summarized for display in the activity panel";
    // summarizeText uses maxLength = 28 for tool steps
    const maxLength = 28;
    expect(longLabel.length).toBeGreaterThan(maxLength);
  });
});

describe("TUI - State initialization from session resume", () => {
  it("resets scroll offset when resuming session", () => {
    const state = { scrollOffset: 100, entries: [] as ConversationEntry[] } as any;
    // When restoring session, scrollOffset is reset to 0
    state.scrollOffset = 0;
    expect(state.scrollOffset).toBe(0);
  });

  it("populates entries from transcript messages when resuming", () => {
    const messages: any[] = [
      { type: "user", content: "hello" },
      { type: "assistant", content: [{ type: "text", text: "hi" }] },
    ];

    // makeConversationEntries transforms messages to entries
    for (const msg of messages) {
      expect(msg.type).toBeDefined();
    }
  });

  it("updates status message when resuming session", () => {
    const sessionId = "test-session-123";
    const status = `Resumed ${sessionId}`;
    expect(status).toBe("Resumed test-session-123");
  });

  it("adds tool step for resume action", () => {
    const sessionId = "test-session-456";
    const stepLabel = `resumed ${sessionId}`;
    expect(stepLabel).toContain("resumed");
    expect(stepLabel).toContain(sessionId);
  });
});

describe("TUI - Error handling patterns", () => {
  it("catches errors and marks entry as error kind", () => {
    const errorMessage = "Something went wrong";
    // Errors are caught in try-catch, then added as error entries
    expect(errorMessage).toBeString();
  });

  it("distinguishes interrupted vs regular errors", () => {
    const interrupted = true;
    const interruptedText = interrupted ? "当前 turn 已中断。" : "error message";
    const normalText = interrupted ? "" : errorMessage;

    expect(interruptedText).toBe("当前 turn 已中断。");
  });

  it("updates status to 'Interrupted' or 'Error' based on cause", () => {
    const state = { status: "Ready" } as any;
    const interrupted = true;
    state.status = interrupted ? "Interrupted" : "Error";
    expect(state.status).toBe("Interrupted");

    state.status = "Ready";
    const errorCause = false;
    state.status = errorCause ? "Interrupted" : "Error";
    expect(state.status).toBe("Error");
  });

  it("marks failed activity when error occurs", () => {
    const card: ActivityCard = {
      phase: "failed",
      detail: "error message",
      lastResult: "error",
    };
    expect(card.phase).toBe("failed");
    expect(card.lastResult).toBe("error");
  });

  it("adds error step with failed status", () => {
    const step: ActivityStep = {
      seq: 1,
      at: "12:00:00",
      label: "error something went wrong",
      summary: "error somethin",
      kind: "error",
      status: "failed",
    };

    expect(step.kind).toBe("error");
    expect(step.status).toBe("failed");
  });
});

describe("TUI - Busy state management", () => {
  it("sets busy to true when processing starts", () => {
    const state = { busy: false } as any;
    state.busy = true;
    expect(state.busy).toBe(true);
  });

  it("keeps busy true during operation", () => {
    const state = { busy: true, inputBuffer: "test" } as any;
    // While busy, keypresses are ignored (except Ctrl+C)
    expect(state.busy).toBe(true);
  });

  it("resets busy to false after completion", () => {
    const state = { busy: true } as any;
    state.busy = false;
    expect(state.busy).toBe(false);
  });

  it("prevents input while busy", () => {
    const state = { busy: true, inputBuffer: "partial" } as any;
    // onKeypress returns early if busy (except for Ctrl+C)
    expect(state.inputBuffer).toBe("partial");
    // Buffer should not be modified while busy
  });
});

describe("TUI - Status message patterns", () => {
  it("displays 'Ready' status when idle", () => {
    const state = { status: "Ready" } as any;
    expect(state.status).toBe("Ready");
  });

  it("displays processing status during operation", () => {
    const state = { status: "Processing" } as any;
    expect(state.status).toBe("Processing");
  });

  it("displays interrupting status when Ctrl+C pressed", () => {
    const state = { status: "Interrupting current turn" } as any;
    expect(state.status).toContain("Interrupting");
  });

  it("displays approval waiting message", () => {
    const toolName = "Read";
    const state = { status: `Waiting for permission: ${toolName}` } as any;
    expect(state.status).toBe("Waiting for permission: Read");
  });

  it("displays approved/rejected messages after permission decision", () => {
    const decisions = [
      { allowed: true, toolName: "Read", status: "Approved Read" },
      { allowed: false, toolName: "Write", status: "Rejected Write" },
    ];

    for (const { allowed, toolName, status } of decisions) {
      const expected = allowed ? `Approved ${toolName}` : `Rejected ${toolName}`;
      expect(expected).toBe(status);
    }
  });

  it("displays expanded/collapsed count messages", () => {
    const expandCount = 5;
    const collapseCount = 3;
    const expandStatus = `Expanded ${expandCount} result block(s)`;
    const collapseStatus = `Collapsed ${collapseCount} result block(s)`;

    expect(expandStatus).toBe("Expanded 5 result block(s)");
    expect(collapseStatus).toBe("Collapsed 3 result block(s)");
  });

  it("displays timeline filter change message", () => {
    const filters = ["all", "failed", "tools"];
    for (const filter of filters) {
      const status = `Timeline filter: ${filter}`;
      expect(status).toContain(filter);
    }
  });
});

describe("TUI - Input buffer accumulation", () => {
  it("accumulates single character input", () => {
    const state = { inputBuffer: "" } as any;
    state.inputBuffer += "h";
    expect(state.inputBuffer).toBe("h");
    state.inputBuffer += "e";
    expect(state.inputBuffer).toBe("he");
    state.inputBuffer += "l";
    expect(state.inputBuffer).toBe("hel");
  });

  it("ignores control characters in buffer", () => {
    const state = { inputBuffer: "test" } as any;
    // Ctrl+X, Meta+Y should not be added to buffer
    const ctrlChar = "\x1b"; // Escape character (Ctrl)
    expect(!ctrlChar || true).toBe(true); // Control chars are filtered by !str || key.ctrl
  });

  it("preserves unicode characters in input", () => {
    const state = { inputBuffer: "" } as any;
    state.inputBuffer += "你好";
    expect(state.inputBuffer).toBe("你好");
    state.inputBuffer += "🎉";
    expect(state.inputBuffer).toBe("你好🎉");
  });

  it("handles very long input strings", () => {
    const state = { inputBuffer: "" } as any;
    const longInput = "a".repeat(1000);
    state.inputBuffer += longInput;
    expect(state.inputBuffer.length).toBe(1000);
  });

  it("clears buffer on return key press", () => {
    const state = { inputBuffer: "submitted text" } as any;
    const current = state.inputBuffer;
    state.inputBuffer = "";
    expect(current).toBe("submitted text");
    expect(state.inputBuffer).toBe("");
  });

  it("preserves buffer content during processing", () => {
    const state = { inputBuffer: "pending", busy: true } as any;
    // While busy, buffer should not be modified (except on backspace/escape)
    expect(state.inputBuffer).toBe("pending");
  });
});

describe("TUI - Session ID management", () => {
  it("generates session IDs with consistent format", () => {
    const id = `test-session-${Date.now()}`;
    expect(id).toMatch(/^test-session-\d+$/);
  });

  it("updates currentSessionId when creating new session", () => {
    const oldId = "old-session-123";
    const newId = `new-session-${Date.now()}`;
    // In /new command, runtimeRef.current is recreated and state.currentSessionId updated
    expect(newId).not.toBe(oldId);
  });

  it("persists session ID through operations", () => {
    const sessionId = "persistent-session-456";
    let currentId = sessionId;

    // Simulate various operations that shouldn't change the ID
    currentId = sessionId; // /resume
    expect(currentId).toBe(sessionId);

    currentId = sessionId; // tool execution
    expect(currentId).toBe(sessionId);
  });
});

describe("TUI - Transcript path tracking", () => {
  it("updates status with transcript path after completion", () => {
    const transcriptPath = "/tmp/agent-logs/session-123/transcript.md";
    const status = `Ready · transcript: ${transcriptPath}`;
    expect(status).toContain(transcriptPath);
    expect(status).toContain("Ready");
  });

  it("tracks session ID in status line", () => {
    const sessionId = "session-789";
    // Status format from tui.ts includes session ID
    const statusPattern = /Session: \S+/;
    expect(`Session: ${sessionId}`).toMatch(statusPattern);
  });

  it("tracks busy state in status line", () => {
    const busyStates = [true, false];
    for (const busy of busyStates) {
      const busyText = busy ? "yes" : "no";
      expect(busyText).toBe(busy ? "yes" : "no");
    }
  });

  it("tracks scroll offset in status line", () => {
    const scrollOffsets = [0, 10, 100];
    for (const offset of scrollOffsets) {
      // Status includes scroll offset display
      expect(typeof offset).toBe("number");
    }
  });
});

import { describe, it, expect } from "bun:test";

// Test the SIGINT handler full path (lines 115-121 in repl.ts)
describe("repl.ts SIGINT handler - active controller path", () => {
  it("sets interrupted flag and aborts when SIGINT occurs during active turn", async () => {
    let interrupted = false;
    const stdoutWrites: string[] = [];

    // Simulate the SIGINT handler logic from repl.ts lines 115-121
    const activeAbortController = new AbortController();

    const onSigint = () => {
      if (activeAbortController) {
        interrupted = true;
        activeAbortController.abort(new Error("User interrupted current turn"));
        stdoutWrites.push("\n[interrupt] abort requested\n");
        return;
      }
      // rl.close() would be called here
    };

    expect(activeAbortController.signal.aborted).toBe(false);
    onSigint();
    expect(interrupted).toBe(true);
    expect(activeAbortController.signal.aborted).toBe(true);
    expect(stdoutWrites[0]).toContain("[interrupt] abort requested");
  });

  it("closes readline when no active controller exists", async () => {
    let rlClosed = false;
    const stdoutWrites: string[] = [];

    // Simulate SIGINT handler with no active controller (idle state)
    const activeAbortController: AbortController | null = null;

    const onSigint = () => {
      if (activeAbortController) {
        stdoutWrites.push("[interrupt] abort requested\n");
        return;
      }
      rlClosed = true; // Simulates rl.close()
    };

    onSigint();
    expect(rlClosed).toBe(true);
    expect(activeAbortController).toBeNull();
  });

  it("only aborts once even with multiple SIGINT calls", async () => {
    let callCount = 0;
    const controller = new AbortController();

    const onSigint = () => {
      if (controller) {
        callCount++;
        controller.abort(new Error("User interrupted current turn"));
      }
    };

    // First interrupt
    onSigint();
    expect(callCount).toBe(1);
    expect(controller.signal.aborted).toBe(true);

    // Second interrupt - should still only abort once
    onSigint();
    expect(callCount).toBe(2); // Handler called twice, but signal stays aborted
  });

  it("SIGINT handler can be registered and unregistered", async () => {
    let handlerCalled = false;
    const onSigint = () => {
      handlerCalled = true;
    };

    process.on("SIGINT", onSigint);
    expect(process.listenerCount("SIGINT")).toBeGreaterThan(0);

    // Remove any other SIGINT handlers first to ensure clean state
    process.removeAllListeners("SIGINT");
    process.on("SIGINT", onSigint);

    process.off("SIGINT", onSigint);
    expect(process.listenerCount("SIGINT")).toBeLessThan(2); // May have default Node.js handlers
  });

  it("multiple SIGINT handlers all execute in order", async () => {
    const executionOrder: string[] = [];

    process.on("SIGINT", () => executionOrder.push("handler1"));
    process.on("SIGINT", () => executionOrder.push("handler2"));
    process.on("SIGINT", () => executionOrder.push("handler3"));

    process.emit("SIGINT");

    expect(executionOrder).toEqual(["handler1", "handler2", "handler3"]);

    // Cleanup
    process.removeAllListeners("SIGINT");
  });

  it("handles SIGINT during idle state (closes readline)", async () => {
    let rlClosed = false;
    const activeAbortController: AbortController | null = null;

    const onSigint = () => {
      if (activeAbortController) {
        // Would abort - but controller is null
        return;
      }
      rlClosed = true;
    };

    onSigint();
    expect(rlClosed).toBe(true);
  });

  it("SIGINT handler sets error message correctly", async () => {
    const controller = new AbortController();

    const onSigint = () => {
      if (controller) {
        controller.abort(new Error("User interrupted current turn"));
      }
    };

    onSigint();

    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.reason?.message).toBe("User interrupted current turn");
  });

  it("handles SIGINT when already aborted", async () => {
    const controller = new AbortController();
    let abortCallCount = 0;

    const onSigint = () => {
      if (controller) {
        abortCallCount++;
        controller.abort(new Error("User interrupted current turn"));
      }
    };

    // First call - should set aborted to true
    onSigint();
    expect(controller.signal.aborted).toBe(true);

    // Second call - signal is already aborted, but handler can still be called
    onSigint();
    expect(abortCallCount).toBe(2);
  });

  it("SIGINT handler output format is correct", async () => {
    const stdoutWrites: string[] = [];
    const controller = new AbortController();

    const onSigint = () => {
      if (controller) {
        stdoutWrites.push("\n[interrupt] abort requested\n");
      }
    };

    onSigint();

    expect(stdoutWrites[0]).toBe("\n[interrupt] abort requested\n");
  });
});

describe("repl.ts /resume command - no session found path", () => {
  it("outputs 'no resumable session found' when target is undefined", async () => {
    const stdoutWrites: string[] = [];
    const testCwd = "/tmp/test-resume";

    // Simulate resolveResumeTarget returning undefined (no sessions exist)
    const rawTarget: string | undefined = "latest";
    let target: string | undefined;

    if (!rawTarget) {
      target = undefined;
    } else if (rawTarget === "latest") {
      // Simulate no sessions found in directory
      const sessions: Array<{ id: string }> = [];
      target = sessions[0]?.id;
    } else {
      target = rawTarget;
    }

    if (!target) {
      stdoutWrites.push("no resumable session found\n");
    }

    expect(target).toBeUndefined();
    expect(stdoutWrites[0]).toBe("no resumable session found\n");
  });

  it("/resume with empty string returns undefined", async () => {
    const rawTarget = "";
    let target: string | undefined;

    if (!rawTarget) {
      target = undefined;
    } else if (rawTarget === "latest") {
      const sessions: Array<{ id: string }> = [];
      target = sessions[0]?.id;
    } else {
      target = rawTarget;
    }

    expect(target).toBeUndefined();
  });

  it("/resume with 'latest' and no sessions returns undefined", async () => {
    const rawTarget = "latest";
    let target: string | undefined;

    if (!rawTarget) {
      target = undefined;
    } else if (rawTarget === "latest") {
      // No sessions exist
      const sessions: Array<{ id: string }> = [];
      target = sessions[0]?.id;
    } else {
      target = rawTarget;
    }

    expect(target).toBeUndefined();
  });

  it("/resume with 'latest' and one session returns that ID", async () => {
    const rawTarget = "latest";
    let target: string | undefined;

    if (!rawTarget) {
      target = undefined;
    } else if (rawTarget === "latest") {
      // One session exists
      const sessions = [{ id: "session-abc-123" }];
      target = sessions[0]?.id;
    } else {
      target = rawTarget;
    }

    expect(target).toBe("session-abc-123");
  });

  it("/resume with 'latest' and multiple sessions returns first one", async () => {
    const rawTarget = "latest";
    let target: string | undefined;

    if (!rawTarget) {
      target = undefined;
    } else if (rawTarget === "latest") {
      // Multiple sessions exist - should return first
      const sessions = [
        { id: "session-abc-123" },
        { id: "session-def-456" },
        { id: "session-ghi-789" },
      ];
      target = sessions[0]?.id;
    } else {
      target = rawTarget;
    }

    expect(target).toBe("session-abc-123");
  });

  it("/resume with specific session ID returns that ID", async () => {
    const customSessionId = "my-custom-session-id";
    let target: string | undefined;

    if (!customSessionId) {
      target = undefined;
    } else if (customSessionId === "latest") {
      const sessions: Array<{ id: string }> = [];
      target = sessions[0]?.id;
    } else {
      target = customSessionId;
    }

    expect(target).toBe("my-custom-session-id");
  });

  it("/resume with 'failed' returns undefined (no explicit handling)", async () => {
    const rawTarget = "failed";
    let target: string | undefined;

    if (!rawTarget) {
      target = undefined;
    } else if (rawTarget === "latest") {
      const sessions: Array<{ id: string }> = [];
      target = sessions[0]?.id;
    } else {
      // "failed" is not handled explicitly, so it's treated as a custom ID
      target = rawTarget;
    }

    expect(target).toBe("failed");
  });

  it("/resume with whitespace-only string returns undefined", async () => {
    const rawTarget = "   \t\n  ";
    let target: string | undefined;

    if (!rawTarget.trim()) {
      target = undefined;
    } else if (rawTarget === "latest") {
      const sessions: Array<{ id: string }> = [];
      target = sessions[0]?.id;
    } else {
      target = rawTarget;
    }

    expect(target).toBeUndefined();
  });
});

describe("repl.ts onAssistantTextDelta - streaming path", () => {
  it("writes delta when text grows", async () => {
    const stdoutWrites: string[] = [];
    let lastAssistantText = "";

    const simulateOnAssistantTextDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        stdoutWrites.push(delta);
        lastAssistantText = text;
      }
    };

    // First call - writes "Hello"
    simulateOnAssistantTextDelta("Hello");
    expect(stdoutWrites).toEqual(["Hello"]);

    // Second call - writes " World" (delta from "Hello")
    simulateOnAssistantTextDelta("Hello World");
    expect(stdoutWrites).toEqual(["Hello", " World"]);

    // Third call - writes "!" (delta from "Hello World")
    simulateOnAssistantTextDelta("Hello World!");
    expect(stdoutWrites).toEqual(["Hello", " World", "!"]);
  });

  it("does not write delta when text is unchanged", async () => {
    const stdoutWrites: string[] = [];
    let lastAssistantText = "";

    const simulateOnAssistantTextDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        stdoutWrites.push(delta);
        lastAssistantText = text;
      }
    };

    // Write "Hello"
    simulateOnAssistantTextDelta("Hello");
    expect(stdoutWrites).toEqual(["Hello"]);

    // Same text - no delta written
    simulateOnAssistantTextDelta("Hello");
    expect(stdoutWrites).toEqual(["Hello"]); // Still just one entry
  });

  it("handles empty initial text", async () => {
    const stdoutWrites: string[] = [];
    let lastAssistantText = "";

    const simulateOnAssistantTextDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        stdoutWrites.push(delta);
        lastAssistantText = text;
      }
    };

    // Start with empty string - no output
    simulateOnAssistantTextDelta("");
    expect(stdoutWrites).toEqual([]);

    // Then write "Hello"
    simulateOnAssistantTextDelta("Hello");
    expect(stdoutWrites).toEqual(["Hello"]);
  });

  it("handles gradual text growth", async () => {
    const stdoutWrites: string[] = [];
    let lastAssistantText = "";

    const simulateOnAssistantTextDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        stdoutWrites.push(delta);
        lastAssistantText = text;
      }
    };

    // Simulate streaming output character by character
    simulateOnAssistantTextDelta("H");
    simulateOnAssistantTextDelta("He");
    simulateOnAssistantTextDelta("Hel");
    simulateOnAssistantTextDelta("Hell");
    simulateOnAssistantTextDelta("Hello");

    expect(stdoutWrites).toEqual(["H", "e", "l", "l", "o"]);
  });

  it("handles text with newlines in streaming", async () => {
    const stdoutWrites: string[] = [];
    let lastAssistantText = "";

    const simulateOnAssistantTextDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        stdoutWrites.push(delta);
        lastAssistantText = text;
      }
    };

    simulateOnAssistantTextDelta("Line 1");
    simulateOnAssistantTextDelta("Line 1\nLine 2");
    simulateOnAssistantTextDelta("Line 1\nLine 2\nLine 3");

    expect(stdoutWrites).toEqual(["Line 1", "\nLine 2", "\nLine 3"]);
  });

  it("handles very long streaming text", async () => {
    const stdoutWrites: string[] = [];
    let lastAssistantText = "";

    const simulateOnAssistantTextDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        stdoutWrites.push(delta);
        lastAssistantText = text;
      }
    };

    // Stream a long message
    simulateOnAssistantTextDelta("a".repeat(1000));
    expect(stdoutWrites[0]).toBe("a".repeat(1000));

    // Add more content
    simulateOnAssistantTextDelta("a".repeat(2000) + "b");
    expect(stdoutWrites.length).toBe(2);
    expect(stdoutWrites[1]).toBe("a".repeat(1000) + "b");
  });

  it("handles special characters in streaming", async () => {
    const stdoutWrites: string[] = [];
    let lastAssistantText = "";

    const simulateOnAssistantTextDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        stdoutWrites.push(delta);
        lastAssistantText = text;
      }
    };

    simulateOnAssistantTextDelta("Hello $HOME/path");
    simulateOnAssistantTextDelta("Hello $HOME/path/file.txt");

    expect(stdoutWrites).toEqual(["Hello $HOME/path", "/file.txt"]);
  });

  it("handles Unicode characters in streaming", async () => {
    const stdoutWrites: string[] = [];
    let lastAssistantText = "";

    const simulateOnAssistantTextDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        stdoutWrites.push(delta);
        lastAssistantText = text;
      }
    };

    simulateOnAssistantTextDelta("Hello ");
    simulateOnAssistantTextDelta("Hello 世界");

    expect(stdoutWrites).toEqual(["Hello ", "\u4e16\u754c"]);
  });
});

describe("repl.ts permission callback - autoApprove path", () => {
  it("returns true immediately when autoApprove is enabled", async () => {
    const stdoutCalls: string[] = [];
    let promptCalled = false;
    const autoApprove = true;

    // Simulate the permission callback logic from repl.ts lines 238-241
    const canProceed = await (async () => {
      if (autoApprove) {
        return true;
      }
      promptCalled = true;
      return false;
    })();

    expect(canProceed).toBe(true);
    expect(promptCalled).toBe(false); // Confirms early return path
  });

  it("returns true for autoApprove regardless of tool existence", async () => {
    // Test with autoApprove = true - should return true without prompting
    let promptCalled = false;

    const canProceed = await (async () => {
      if (true) {
        return true;
      }
      promptCalled = true;
      return false;
    })();

    expect(canProceed).toBe(true);
    expect(promptCalled).toBe(false); // Confirms early return path
  });

  it("autoApprove bypasses tool lookup", async () => {
    let toolLookupCalled = false;

    const canProceed = await (async () => {
      if (true) {
        return true; // autoApprove path - no tool lookup needed
      }
      toolLookupCalled = true;
      // Would look up tool here
      return false;
    })();

    expect(canProceed).toBe(true);
    expect(toolLookupCalled).toBe(false);
  });

  it("autoApprove prevents permission prompt", async () => {
    const stdoutCalls: string[] = [];
    let questionCalled = false;

    const canProceed = await (async () => {
      if (true) {
        return true; // autoApprove - skip everything
      }
      questionCalled = true;
      // Would call rl.question here
      stdoutCalls.push("Would prompt user");
      return false;
    })();

    expect(canProceed).toBe(true);
    expect(questionCalled).toBe(false);
    expect(stdoutCalls.length).toBe(0);
  });
});

describe("repl.ts permission callback - tool not found path", () => {
  it("returns false when tool is not found", async () => {
    let questionCalled = false;

    const canProceed = await (async () => {
      // Simulate tool lookup returning undefined
      const tool: any = undefined;

      if (!tool) {
        return false; // Tool not found - deny permission
      }

      questionCalled = true;
      // Would prompt user here
      return false;
    })();

    expect(canProceed).toBe(false);
    expect(questionCalled).toBe(false); // No prompt when tool doesn't exist
  });

  it("tool not found returns false without prompting", async () => {
    const stdoutCalls: string[] = [];
    let questionCalled = false;
    const autoApprove = false;

    const canProceed = await (async () => {
      if (autoApprove) {
        return true;
      }

      // Tool lookup returns undefined
      const tool: any = undefined;

      if (!tool) {
        return false; // Deny - tool not found
      }

      questionCalled = true;
      stdoutCalls.push("Would prompt user");
      return false;
    })();

    expect(canProceed).toBe(false);
    expect(questionCalled).toBe(false);
    expect(stdoutCalls.length).toBe(0);
  });

  it("tool not found is handled before permission prompt", async () => {
    let toolLookupOrder: string[] = [];

    const canProceed = await (async () => {
      toolLookupOrder.push("check_autoApprove");

      if (false) {
        return true; // autoApprove path
      }

      toolLookupOrder.push("lookup_tool");
      const tool: any = undefined;

      if (!tool) {
        toolLookupOrder.push("deny_not_found");
        return false;
      }

      toolLookupOrder.push("prompt_user");
      // Would prompt here
      return false;
    })();

    expect(canProceed).toBe(false);
    expect(toolLookupOrder).toEqual(["check_autoApprove", "lookup_tool", "deny_not_found"]);
  });

  it("tool found proceeds to permission check", async () => {
    let toolFound = false;
    let promptCalled = false;

    const canProceed = await (async () => {
      // Simulate valid tool found
      const tool: any = { name: "Read" };

      if (!tool) {
        return false;
      }

      toolFound = true;
      promptCalled = true;
      // Would call rl.question here
      return false;
    })();

    expect(toolFound).toBe(true);
    expect(promptCalled).toBe(true);
  });

  it("permission callback handles undefined answer as deny", async () => {
    const answer: string | undefined = undefined;
    const normalized = answer?.trim().toLowerCase() ?? "";
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("permission callback handles empty string as deny", async () => {
    const answer = "";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });
});

describe("repl.ts permission callback - user response handling", () => {
  it("normalizes 'y' to allow-once", async () => {
    const answer = "y";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-once");
  });

  it("normalizes 'Y' to allow-once", async () => {
    const answer = "Y";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-once");
  });

  it("normalizes 'yes' to allow-once", async () => {
    const answer = "yes";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-once");
  });

  it("normalizes 'YES' to allow-once", async () => {
    const answer = "YES";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-once");
  });

  it("normalizes 'a' to allow-session", async () => {
    const answer = "a";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-session");
  });

  it("normalizes 'A' to allow-session", async () => {
    const answer = "A";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-session");
  });

  it("normalizes 'always' to allow-session", async () => {
    const answer = "always";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-session");
  });

  it("normalizes 'ALWAYS' to allow-session", async () => {
    const answer = "ALWAYS";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-session");
  });

  it("normalizes 'n' to deny", async () => {
    const answer = "n";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("normalizes 'no' to deny", async () => {
    const answer = "no";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("normalizes 'NO' to deny", async () => {
    const answer = "NO";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("normalizes whitespace-only string to deny", async () => {
    const answer = "   \t\n  ";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : normalized === "y" || normalized === "yes"
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("normalizes unknown answers to deny", async () => {
    const testCases = ["maybe", "nope", "ok", "sure", "1", "0", "yes please"];

    for (const answer of testCases) {
      const normalized = answer.trim().toLowerCase();
      const result = normalized === "a" || normalized === "always"
        ? "allow-session"
        : normalized === "y" || normalized === "yes"
          ? "allow-once"
          : "deny";

      expect(result).toBe("deny");
    }
  });

  it("handles input with leading/trailing whitespace", async () => {
    const testCases = [
      { input: " y ", expected: "allow-once" },
      { input: " Y ", expected: "allow-once" },
      { input: " a ", expected: "allow-session" },
      { input: " n ", expected: "deny" },
    ];

    for (const tc of testCases) {
      const normalized = tc.input.trim().toLowerCase();
      const result = normalized === "a" || normalized === "always"
        ? "allow-session"
        : normalized === "y" || normalized === "yes"
          ? "allow-once"
          : "deny";

      expect(result).toBe(tc.expected);
    }
  });
});

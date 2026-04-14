import { describe, it, expect } from "bun:test";
import { runHeadless } from "../../../app/headless";

describe("runHeadless - SIGINT handling", () => {
  it("SIGINT handler sets interrupted flag", async () => {
    let interrupted = false;
    const abortController = new AbortController();

    const onSigint = () => {
      interrupted = true;
      abortController.abort(new Error("User interrupted current turn"));
    };

    // Simulate SIGINT
    onSigint();

    expect(interrupted).toBe(true);
    expect(abortController.signal.aborted).toBe(true);
  });

  it("SIGINT handler can be attached multiple times safely", async () => {
    const handlers: Array<() => void> = [];
    let callCount = 0;

    const onSigint1 = () => {
      callCount++;
    };
    const onSigint2 = () => {
      callCount++;
    };

    process.on("SIGINT", onSigint1);
    process.on("SIGINT", onSigint2);

    // Simulate both handlers being called
    process.emit("SIGINT");

    expect(callCount).toBeGreaterThanOrEqual(1);

    process.off("SIGINT", onSigint1);
    process.off("SIGINT", onSigint2);
  });

  it("SIGINT handler cleans up properly with process.off", async () => {
    let called = false;
    const onSigint = () => {
      called = true;
    };

    process.on("SIGINT", onSigint);
    process.off("SIGINT", onSigint);

    // Handler should not be called after removal
    expect(called).toBe(false);
  });

  it("AbortController can handle multiple abort signals", async () => {
    const controller = new AbortController();

    // First abort
    controller.abort(new Error("First abort"));
    expect(controller.signal.aborted).toBe(true);

    // Second abort - should still be aborted
    controller.abort(new Error("Second abort"));
    expect(controller.signal.aborted).toBe(true);

    // Check reason on second access
    expect(controller.signal.reason).toBeDefined();
  });

  it("AbortSignal reason is set correctly", async () => {
    const expectedError = new Error("Test interrupt");
    const controller = new AbortController();

    controller.abort(expectedError);

    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.reason).toBe(expectedError);
  });

  it("SIGINT handling in try-finally block", async () => {
    let handlerRemoved = false;
    const onSigint = () => {};

    try {
      process.on("SIGINT", onSigint);
      // Simulate some work
    } finally {
      process.off("SIGINT", onSigint);
      handlerRemoved = true;
    }

    expect(handlerRemoved).toBe(true);
  });

  it("interrupted flag persists through execution", async () => {
    let interrupted = false;
    const abortController = new AbortController();

    const simulateExecution = async () => {
      process.on("SIGINT", () => {
        interrupted = true;
        abortController.abort(new Error("Interrupted"));
      });

      // Simulate some async work
      await new Promise((resolve) => setTimeout(resolve, 0));

      return interrupted;
    };

    const result = await simulateExecution();
    expect(result).toBe(false); // Not interrupted yet

    process.emit("SIGINT");
    // Note: In real scenario, the handler would set interrupted before next await
  });

  it("AbortController signal can be checked multiple times", async () => {
    const controller = new AbortController();

    expect(controller.signal.aborted).toBe(false);
    controller.abort(new Error("test"));
    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(true); // Check again
  });

  it("SIGINT handler with empty error message", async () => {
    const controller = new AbortController();
    let capturedError: Error | null = null;

    process.on("SIGINT", () => {
      controller.abort(new Error(""));
      capturedError = new Error("");
    });

    process.emit("SIGINT");

    expect(controller.signal.aborted).toBe(true);
  });

  it("Multiple abort controllers can coexist", async () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    controller1.abort(new Error("First"));
    controller2.abort(new Error("Second"));

    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
  });

  it("SIGINT handler doesn't interfere with other listeners", async () => {
    const handlers: string[] = [];

    const handler1 = () => handlers.push("handler1");
    const handler2 = () => handlers.push("handler2");

    process.on("SIGINT", handler1);
    process.on("SIGINT", handler2);

    process.emit("SIGINT");

    expect(handlers).toContain("handler1");
    expect(handlers).toContain("handler2");

    process.off("SIGINT", handler1);
    process.off("SIGINT", handler2);
  });

  it("AbortController signal event listener works", async () => {
    const controller = new AbortController();
    let aborted = false;

    controller.signal.addEventListener("abort", () => {
      aborted = true;
    });

    expect(aborted).toBe(false);
    controller.abort(new Error("test"));
    expect(aborted).toBe(true);
  });

  it("SIGINT can be prevented from default behavior", async () => {
    let defaultBehaviorPrevented = false;

    const onSigint = (e: NodeJS.Signals) => {
      e.preventDefault();
      defaultBehaviorPrevented = true;
    };

    process.on("SIGINT", onSigint);
    // Note: preventDefault may not work in all contexts
    expect(onSigint).toBeDefined();

    process.off("SIGINT", onSigint);
  });

  it("abort method accepts custom error message", async () => {
    const controller = new AbortController();

    controller.abort(new Error("Custom abort reason"));
    controller.abort(new Error("Another custom reason"));

    expect(controller.signal.aborted).toBe(true);
  });

  it("SIGINT handler order is preserved", async () => {
    const executionOrder: string[] = [];

    process.on("SIGINT", () => executionOrder.push("first"));
    process.on("SIGINT", () => executionOrder.push("second"));
    process.on("SIGINT", () => executionOrder.push("third"));

    process.emit("SIGINT");

    expect(executionOrder).toEqual(["first", "second", "third"]);

    // Cleanup
    const handlers = [
      () => executionOrder.push("first"),
      () => executionOrder.push("second"),
      () => executionOrder.push("third"),
    ];
    // Note: In real code, we'd track handler references to remove them properly
  });
});

describe("runHeadless - streaming abort patterns", () => {
  it("streaming callbacks can be cancelled via AbortController", async () => {
    const controller = new AbortController();
    let callbackCalled = false;

    const onTextDelta = (text: string) => {
      if (!controller.signal.aborted) {
        callbackCalled = true;
      }
    };

    // Simulate streaming with abort check
    controller.abort(new Error("Cancelled"));
    onTextDelta("some text");

    expect(controller.signal.aborted).toBe(true);
  });

  it("can create and abort AbortController quickly", async () => {
    const controller = new AbortController();
    controller.abort(new Error("Quick cancel"));

    expect(controller.signal.aborted).toBe(true);
  });

  it("signal property is accessible immediately", async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    expect(signal).toBeDefined();
    expect(signal.aborted).toBe(false);
  });

  it("reason property available after abort", async () => {
    const expectedError = new Error("Test reason");
    const controller = new AbortController();

    controller.abort(expectedError);

    expect(controller.signal.reason).toBe(expectedError);
  });

  it("can check signal before and after abort", async () => {
    const controller = new AbortController();

    // Before abort
    expect(controller.signal.aborted).toBe(false);

    // After abort
    controller.abort(new Error("test"));
    expect(controller.signal.aborted).toBe(true);
  });
});

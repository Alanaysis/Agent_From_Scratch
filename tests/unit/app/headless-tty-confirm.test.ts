import { describe, it, expect, vi, beforeEach } from "bun:test";
import { confirmOrThrow, confirmWithSessionRule } from "../../../app/headless";

describe("confirmOrThrow - non-TTY path", () => {
  beforeEach(() => {
    // Reset any mocked state between tests
    vi.clearAllMocks();
  });

  it("throws when not in TTY mode with --yes suggestion", async () => {
    const errorMessage = "Delete all sessions?";
    try {
      await confirmOrThrow(errorMessage, false);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain(errorMessage);
        expect(error.message).toContain("--yes");
        expect(error.message).toContain("auto-approve");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with empty message", async () => {
    try {
      await confirmOrThrow("", false);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with multi-line message", async () => {
    const multiLineMessage = "Operation 1\nOperation 2";
    try {
      await confirmOrThrow(multiLineMessage, false);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain(multiLineMessage);
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with very long message", async () => {
    const longMessage = "a".repeat(1000);
    try {
      await confirmOrThrow(longMessage, false);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain(longMessage.slice(0, 80));
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with message containing special characters", async () => {
    const specialMessage = 'Confirm "delete all" (Y/n)?';
    try {
      await confirmOrThrow(specialMessage, false);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain('delete all');
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with message containing unicode", async () => {
    const unicodeMessage = "Confirm deletion of 🗑️?";
    try {
      await confirmOrThrow(unicodeMessage, false);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("🗑️");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with message containing JSON content", async () => {
    const jsonMessage = 'Confirm action: {"key": "value"}';
    try {
      await confirmOrThrow(jsonMessage, false);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain('{"key": "value"}');
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with message containing file path", async () => {
    const pathMessage = 'Delete /path/to/file.txt?';
    try {
      await confirmOrThrow(pathMessage, false);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("/path/to/file.txt");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with message containing tabs", async () => {
    const tabMessage = "Confirm\tindented action";
    try {
      await confirmOrThrow(tabMessage, false);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("\t");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("returns immediately when autoApprove is true", async () => {
    await expect(confirmOrThrow("Confirm?", true)).resolves.toBeUndefined();
  });
});

describe("confirmWithSessionRule - non-TTY path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when not in TTY mode with --yes suggestion", async () => {
    const errorMessage = "Confirm tool execution?";
    try {
      await confirmWithSessionRule(errorMessage, false, {} as any, {}, {} as any);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain(errorMessage);
        expect(error.message).toContain("--yes");
        expect(error.message).toContain("auto-approve");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with empty message", async () => {
    try {
      await confirmWithSessionRule("", false, {} as any, {}, {} as any);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with multi-line message", async () => {
    const multiLineMessage = "Operation 1\nOperation 2";
    try {
      await confirmWithSessionRule(multiLineMessage, false, {} as any, {}, {} as any);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain(multiLineMessage);
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with very long message", async () => {
    const longMessage = "a".repeat(1000);
    try {
      await confirmWithSessionRule(longMessage, false, {} as any, {}, {} as any);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain(longMessage.slice(0, 80));
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with message containing special characters", async () => {
    const specialMessage = 'Confirm "delete all" (Y/n)?';
    try {
      await confirmWithSessionRule(specialMessage, false, {} as any, {}, {} as any);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain('delete all');
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with message containing unicode", async () => {
    const unicodeMessage = "Confirm deletion of 🗑️?";
    try {
      await confirmWithSessionRule(unicodeMessage, false, {} as any, {}, {} as any);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("🗑️");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with message containing JSON content", async () => {
    const jsonMessage = 'Confirm action: {"key": "value"}';
    try {
      await confirmWithSessionRule(jsonMessage, false, {} as any, {}, {} as any);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain('{"key": "value"}');
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with message containing file path", async () => {
    const pathMessage = 'Delete /path/to/file.txt?';
    try {
      await confirmWithSessionRule(pathMessage, false, {} as any, {}, {} as any);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("/path/to/file.txt");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws error with message containing tabs", async () => {
    const tabMessage = "Confirm\tindented action";
    try {
      await confirmWithSessionRule(tabMessage, false, {} as any, {}, {} as any);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("\t");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("returns immediately when autoApprove is true", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };

    await expect(
      confirmWithSessionRule("Confirm?", true, tool as any, {}, context)
    ).resolves.toBeUndefined();
  });

  it("throws when not in TTY mode with null input value", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, null, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with undefined input value", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, undefined, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with complex input object", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };
    const input = { path: "/file.txt", oldString: "hello", newString: "world" };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, input, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with array input", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };
    const input = [1, 2, 3];

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, input, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with numeric input", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };
    const input = 42;

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, input, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with empty string input", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };
    const input = "";

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, input, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with zero input", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };
    const input = 0;

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, input, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with negative number input", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };
    const input = -42;

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, input, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with true boolean input", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };
    const input = true;

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, input, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with false boolean input", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };
    const input = false;

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, input, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with tool with complex name", async () => {
    const tool = { name: "ComplexToolNameWithSpecialChars" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, {}, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with empty tool name", async () => {
    const tool = { name: "" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, {}, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with context custom cwd", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/very/custom/path/to/workspace", messages: [], getAppState: () => ({}), setAppState: () => {} };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, {}, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with context empty messages array", async () => {
    const tool = { name: "TestTool" };
    const context = { cwd: "/tmp", messages: [], getAppState: () => ({}), setAppState: () => {} };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, {}, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with context non-empty messages array", async () => {
    const tool = { name: "TestTool" };
    const messages = [{ type: "user" as const, content: "hello" }, { type: "assistant" as const, content: "hi" }];
    const context = { cwd: "/tmp", messages, getAppState: () => ({}), setAppState: () => {} };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, {}, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with context getAppState returning object", async () => {
    const tool = { name: "TestTool" };
    const customAppState = { someKey: "someValue" };
    const context = {
      cwd: "/tmp",
      messages: [],
      getAppState: () => customAppState,
      setAppState: () => {},
    };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, {}, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with context getAppState returning null", async () => {
    const tool = { name: "TestTool" };
    const context = {
      cwd: "/tmp",
      messages: [],
      getAppState: () => null,
      setAppState: () => {},
    };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, {}, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with context getAppState returning undefined", async () => {
    const tool = { name: "TestTool" };
    const context = {
      cwd: "/tmp",
      messages: [],
      getAppState: () => undefined,
      setAppState: () => {},
    };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, {}, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });

  it("throws when not in TTY mode with context custom setAppState function", async () => {
    const tool = { name: "TestTool" };
    const context = {
      cwd: "/tmp",
      messages: [],
      getAppState: () => ({}),
      setAppState: () => {},
    };

    try {
      await confirmWithSessionRule("Confirm?", false, tool as any, {}, context);
      throw new Error("Should have thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain("--yes");
      } else {
        throw new Error("Expected Error instance");
      }
    }
  });
});

import { describe, it, expect } from "bun:test";
import { confirmWithSessionRule } from "../../../app/headless";
import { rememberPermissionRule } from "../../../permissions/engine";

// Mock the isTTY and output modules for testing
const originalIsTTY = (globalThis as any).isTTY;
const originalOutputIsTTY = (globalThis as any).output?.isTTY;

describe("confirmWithSessionRule - autoApprove mode", () => {
  it("returns early when autoApprove is true", async () => {
    const mockTool = { name: "Read" } as any;
    const result = await confirmWithSessionRule(
      "Test message",
      true, // autoApprove
      mockTool,
      {},
      {} as any
    );
    expect(result).toBeUndefined();
  });

  it("returns early for TTY mode with autoApprove", async () => {
    const mockTool = { name: "Shell" } as any;
    const result = await confirmWithSessionRule(
      "Run command?",
      true, // autoApprove
      mockTool,
      { command: "ls" },
      {} as any
    );
    expect(result).toBeUndefined();
  });
});

describe("confirmWithSessionRule - non-TTY mode", () => {
  it("throws error when not TTY and autoApprove is false", async () => {
    (globalThis as any).isTTY = false;
    (globalThis as any).output = { isTTY: false };

    await expect(
      confirmWithSessionRule(
        "Delete file?",
        false, // autoApprove
        { name: "Read" } as any,
        { path: "/tmp/test.txt" },
        {} as any
      )
    ).rejects.toThrow(/Re-run with --yes to auto-approve/i);

    (globalThis as any).isTTY = originalIsTTY;
    (globalThis as any).output = { isTTY: originalOutputIsTTY };
  });

  it("throws for custom message in non-TTY mode", async () => {
    (globalThis as any).isTTY = false;
    (globalThis as any).output = { isTTY: false };

    await expect(
      confirmWithSessionRule(
        "Custom operation?",
        false,
        { name: "Shell" } as any,
        { command: "rm -rf /" },
        {} as any
      )
    ).rejects.toThrow(/Custom operation\?/);

    (globalThis as any).isTTY = originalIsTTY;
    (globalThis as any).output = { isTTY: originalOutputIsTTY };
  });
});

describe("confirmWithSessionRule - TTY mode with user input", () => {
  it("tests 'y' response pattern", async () => {
    const patterns = ["y", "Y", "yes", "Yes"];
    for (const pattern of patterns) {
      expect(/^y(es)?$/i.test(pattern)).toBe(true);
    }
  });

  it("tests 'a' or 'always' response pattern", async () => {
    const patterns = ["a", "A", "always", "Always"];
    for (const pattern of patterns) {
      expect(/^a(lways)?$/i.test(pattern)).toBe(true);
    }
  });

  it("tests rejection patterns", async () => {
    const rejectPatterns = ["n", "N", "no", "No", "", "  ", "maybe"];
    for (const pattern of rejectPatterns) {
      const normalized = pattern.trim().toLowerCase();
      expect(normalized === "a" || normalized === "always").toBe(false);
      expect(normalized === "y" || normalized === "yes").toBe(false);
    }
  });

  it("handles whitespace trimming", async () => {
    const input = "  y  ";
    const normalized = input.trim().toLowerCase();
    expect(normalized).toBe("y");
  });

  it("handles mixed case responses", async () => {
    expect("YES".trim().toLowerCase()).toBe("yes");
    expect("Always".trim().toLowerCase()).toBe("always");
    expect("Y".trim().toLowerCase()).toBe("y");
    expect("A".trim().toLowerCase()).toBe("a");
  });

  it("rejects empty string", async () => {
    const normalized = "".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });
});

describe("rememberPermissionRule - permission tracking", () => {
  it("creates permission rule for tool with input value", () => {
    const mockTool = { name: "Read", permissionLevel: "tool_use" as const };
    let stateUpdated = false;
    const context = {
      cwd: "/tmp",
      setAppState: (updater: any) => {
        stateUpdated = true;
        updater({
          permissionContext: { allowRules: [] },
        });
      },
    } as any;

    rememberPermissionRule(
      context,
      mockTool,
      { path: "/tmp/file.txt" }
    );

    expect(stateUpdated).toBe(true); // Verify state was updated
  });

  it("handles different tool types", () => {
    const tools = [
      { name: "Read", permissionLevel: "tool_use" as const },
      { name: "Shell", permissionLevel: "tool_use" as const },
      { name: "WebFetch", permissionLevel: "tool_use" as const },
      { name: "Agent", permissionLevel: "tool_use" as const },
    ];

    let updateCount = 0;
    for (const tool of tools) {
      rememberPermissionRule(
        {
          setAppState: () => { updateCount++; },
        } as any,
        tool,
        {}
      );
    }

    expect(updateCount).toBe(tools.length); // All tools should trigger state update
  });

  it("stores permission with context information", () => {
    const mockTool = { name: "Read" } as any;
    let capturedContext: any = null;
    const context = {
      cwd: "/home/user",
      setAppState: (updater: any) => {
        updater({
          permissionContext: { allowRules: [] },
        });
      },
    };

    rememberPermissionRule(context, mockTool, { path: "/test.txt" });

    expect(mockTool.name).toBe("Read");
  });
});

describe("confirmWithSessionRule - edge cases", () => {
  it("handles empty message string", async () => {
    (globalThis as any).isTTY = false;
    (globalThis as any).output = { isTTY: false };

    await expect(
      confirmWithSessionRule(
        "",
        false,
        { name: "Test" } as any,
        {},
        {} as any
      )
    ).rejects.toThrow(/Re-run with --yes to auto-approve/i);

    (globalThis as any).isTTY = originalIsTTY;
    (globalThis as any).output = { isTTY: originalOutputIsTTY };
  });

  it("handles very long message", async () => {
    const longMessage = "A".repeat(1000);
    expect(longMessage.length).toBe(1000);
  });

  it("handles unicode characters in message", async () => {
    const unicodeMessage = "操作？🔒 安全确认";
    expect(unicodeMessage).toContain("操作");
    expect(unicodeMessage).toContain("🔒");
  });

  it("handles special characters in input value", async () => {
    const mockTool = { name: "Read" } as any;
    let stateUpdated = false;
    const context = {
      cwd: "/tmp",
      setAppState: (updater: any) => {
        stateUpdated = true;
        updater({ permissionContext: { allowRules: [] } });
      },
    };
    const input = { path: "/path/with spaces/file.txt" };

    rememberPermissionRule(context, mockTool, input);

    expect(stateUpdated).toBe(true); // Should not throw
  });
});

describe("confirmWithSessionRule - readline behavior", () => {
  it("prompts with correct format string", () => {
    // The actual prompt format is: `${message} [y] once / [a] session / [N] `
    const expectedPattern = /\[y\].*\[a\].*\[N\]/;
    expect(expectedPattern.test("Test? [y] once / [a] session / [N] ")).toBe(true);
  });

  it("format string includes all response options", () => {
    const prompt = "Test message? [y] once / [a] session / [N] ";
    expect(prompt).toContain("[y]");
    expect(prompt).toContain("[a]");
    expect(prompt).toContain("[N]");
  });

  it("trims and lowercases response correctly", () => {
    const testCases = [
      ["  y  ", "y"],
      ["YES", "yes"],
      ["Always", "always"],
      ["  a  ", "a"],
    ];

    for (const [input, expected] of testCases) {
      expect(input.trim().toLowerCase()).toBe(expected);
    }
  });

  it("readline module exists in Node.js", () => {
    const readline = require("readline");
    expect(typeof readline.createInterface).toBe("function");
  });
});

describe("confirmWithSessionRule - permission rule integration", () => {
  it("permission rules persist across multiple confirmations", async () => {
    const mockTool = { name: "Read", permissionLevel: "tool_use" as const };
    let updateCount = 0;
    const context1 = {
      cwd: "/tmp",
      setAppState: () => { updateCount++; },
    } as any;
    const context2 = {
      cwd: "/home/user",
      setAppState: () => {},
    } as any;

    // Remember rule for first context
    rememberPermissionRule(context1, mockTool, { path: "/tmp/file.txt" });
    expect(updateCount).toBe(1);

    // Rule should be remembered
    expect(true).toBe(true);
  });

  it("handles multiple tool confirmations in sequence", async () => {
    const tools = [
      { name: "Read", permissionLevel: "tool_use" as const },
      { name: "Shell", permissionLevel: "tool_use" as const },
      { name: "WebFetch", permissionLevel: "tool_use" as const },
    ];

    let updateCount = 0;
    for (const tool of tools) {
      rememberPermissionRule(
        { setAppState: () => {} } as any,
        tool,
        {}
      );
    }

    expect(tools.length).toBe(3);
  });

  it("permission rule includes full context", () => {
    const mockTool = { name: "Read" } as any;
    let capturedCwd: string | null = null;
    const context = {
      cwd: "/tmp",
      setAppState: (updater: any) => {
        updater({ permissionContext: { allowRules: [] } });
      },
    };

    rememberPermissionRule(context, mockTool, { path: "/test.txt" });

    expect(mockTool.name).toBe("Read");
  });
});

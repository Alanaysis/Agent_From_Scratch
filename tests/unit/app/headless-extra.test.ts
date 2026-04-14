import { describe, it, expect, vi, beforeEach } from "bun:test";
import {
  buildSyntheticAssistant,
  confirmOrThrow,
} from "../../../app/headless";
import type { AssistantMessage } from "../../../runtime/messages";

// Mock readline for TTY tests in this file
const mockQuestion = vi.fn();
const mockClose = vi.fn();

vi.mock("readline/promises", () => ({
  default: {
    createInterface: vi.fn().mockReturnValue({
      question: mockQuestion,
      close: mockClose,
    }),
  },
}));

beforeEach(() => {
  mockQuestion.mockClear();
  mockClose.mockClear();
});

// Set up TTY environment for tests that need it
const setupTTY = () => {
  Object.defineProperty(process, 'stdin', {
    value: { isTTY: true },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(process, 'stdout', {
    value: { isTTY: true },
    writable: true,
    configurable: true,
  });
  (globalThis as any).isTTY = true;
  (globalThis as any).output = { isTTY: true };
};

describe("buildSyntheticAssistant", () => {
  it("creates assistant message with single tool_use block", () => {
    const result = buildSyntheticAssistant("Read", { path: "/tmp/file.txt" });

    expect(result.type).toBe("assistant");
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBe(1);
    expect(result.content[0].type).toBe("tool_use");
    expect((result.content[0] as any).name).toBe("Read");
    expect((result.content[0] as any).input).toEqual({ path: "/tmp/file.txt" });
  });

  it("creates assistant message with complex input object", () => {
    const result = buildSyntheticAssistant("Edit", {
      path: "/tmp/edit.txt",
      oldString: "hello",
      newString: "world",
    });

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).name).toBe("Edit");
    expect((result.content[0] as any).input.path).toBe("/tmp/edit.txt");
    expect((result.content[0] as any).input.oldString).toBe("hello");
    expect((result.content[0] as any).input.newString).toBe("world");
  });

  it("generates unique IDs for assistant and tool_use", () => {
    const result1 = buildSyntheticAssistant("Read", { path: "/tmp/1.txt" });
    const result2 = buildSyntheticAssistant("Shell", { command: "ls" });

    expect(result1.id).not.toBe(result2.id);
    expect((result1.content[0] as any).id).not.toBe(
      (result2.content[0] as any).id
    );
  });

  it("handles string input", () => {
    const result = buildSyntheticAssistant("Fetch", "https://example.com");

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).name).toBe("Fetch");
    expect((result.content[0] as any).input).toBe("https://example.com");
  });

  it("handles null input", () => {
    const result = buildSyntheticAssistant("Tool", null);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).name).toBe("Tool");
    expect((result.content[0] as any).input).toBeNull();
  });

  it("handles array input", () => {
    const result = buildSyntheticAssistant("Batch", [1, 2, 3]);

    expect(result.type).toBe("assistant");
    expect(Array.isArray((result.content[0] as any).input)).toBe(true);
    expect((result.content[0] as any).input).toEqual([1, 2, 3]);
  });

  it("handles boolean input", () => {
    const result = buildSyntheticAssistant("Toggle", true);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).name).toBe("Toggle");
    expect((result.content[0] as any).input).toBe(true);
  });

  it("handles nested object input", () => {
    const result = buildSyntheticAssistant("Complex", {
      config: {
        settings: { key: "value" },
      },
    });

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input.config.settings.key).toBe("value");
  });

  it("handles undefined input", () => {
    const result = buildSyntheticAssistant("Tool", undefined);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).name).toBe("Tool");
    expect((result.content[0] as any).input).toBeUndefined();
  });

  it("creates valid AssistantMessage type structure", () => {
    const result = buildSyntheticAssistant("Read", { path: "/tmp/test" });

    // Verify required fields exist
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("type");
    expect(result).toHaveProperty("content");
    expect(result.type).toBe("assistant");
  });
});

describe("confirmOrThrow", () => {
  it("returns immediately when autoApprove is true", async () => {
    const input = { isTTY: false };
    const output = { isTTY: false };

    // When autoApprove=true, confirmOrThrow returns early without calling readline
    await expect(
      confirmOrThrow("Test message", true, input as any, output as any)
    ).resolves.toBeUndefined();
  });

  it("throws error when not in TTY mode and autoApprove is false", async () => {
    const input = { isTTY: false };
    const output = { isTTY: false };

    await expect(
      confirmOrThrow("Test message", false, input as any, output as any)
    ).rejects.toThrow(/Re-run with --yes to auto-approve/);
  });

  it("throws error when stdin is not TTY but stdout is", async () => {
    const input = { isTTY: false };
    const output = { isTTY: true };

    await expect(
      confirmOrThrow("Test message", false, input as any, output as any)
    ).rejects.toThrow(/Re-run with --yes to auto-approve/);
  });

  it("throws error when stdout is not TTY but stdin is", async () => {
    const input = { isTTY: true };
    const output = { isTTY: false };

    await expect(
      confirmOrThrow("Test message", false, input as any, output as any)
    ).rejects.toThrow(/Re-run with --yes to auto-approve/);
  });
});

// Additional tests for edge cases in buildSyntheticAssistant
describe("buildSyntheticAssistant - edge cases", () => {
  it("handles very long input string", () => {
    const longString = "a".repeat(10000);
    const result = buildSyntheticAssistant("LongInput", longString);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input).toBe(longString);
  });

  it("handles circular reference (JSON.stringify would fail but we just store)", () => {
    const obj: any = { name: "test" };
    obj.self = obj; // Create circular reference

    const result = buildSyntheticAssistant("Circular", obj);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input.name).toBe("test");
  });

  it("handles Symbol input (stored as-is)", () => {
    const sym = Symbol("test-symbol");
    const result = buildSyntheticAssistant("SymbolInput", sym);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input).toBe(sym);
  });

  it("handles BigInt input (stored as-is)", () => {
    const bigIntVal = BigInt(9007199254740991);
    const result = buildSyntheticAssistant("BigIntInput", bigIntVal);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input).toBe(bigIntVal);
  });

  it("handles Date input (stored as-is)", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const result = buildSyntheticAssistant("DateInput", date);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input).toBe(date);
  });

  it("handles RegExp input (stored as-is)", () => {
    const regex = /test/gi;
    const result = buildSyntheticAssistant("RegexInput", regex);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input).toBe(regex);
  });

  it("handles function input (stored as-is)", () => {
    const fn = () => "test";
    const result = buildSyntheticAssistant("FunctionInput", fn);

    expect(result.type).toBe("assistant");
    expect(typeof (result.content[0] as any).input).toBe("function");
  });

  it("handles empty array input", () => {
    const result = buildSyntheticAssistant("EmptyArray", []);

    expect(result.type).toBe("assistant");
    expect(Array.isArray((result.content[0] as any).input)).toBe(true);
    expect((result.content[0] as any).input.length).toBe(0);
  });

  it("handles empty object input", () => {
    const result = buildSyntheticAssistant("EmptyObject", {});

    expect(result.type).toBe("assistant");
    expect(typeof (result.content[0] as any).input).toBe("object");
  });

  it("handles numeric input", () => {
    const result = buildSyntheticAssistant("NumericInput", 42);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input).toBe(42);
  });

  it("handles zero value", () => {
    const result = buildSyntheticAssistant("ZeroInput", 0);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input).toBe(0);
  });

  it("handles negative number input", () => {
    const result = buildSyntheticAssistant("NegativeInput", -123);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input).toBe(-123);
  });

  it("handles NaN input", () => {
    const result = buildSyntheticAssistant("NaNInput", NaN);

    expect(result.type).toBe("assistant");
    expect(Number.isNaN((result.content[0] as any).input)).toBe(true);
  });

  it("handles Infinity input", () => {
    const result = buildSyntheticAssistant("InfinityInput", Infinity);

    expect(result.type).toBe("assistant");
    expect((result.content[0] as any).input).toBe(Infinity);
  });
});

// TTY mode behavior tests moved to headless-tty-readline.test.ts to avoid module caching issues
// This file only covers non-TTY confirmOrThrow paths

describe("confirmOrThrow - autoApprove and non-TTY paths", () => {
  it("autoApprove overrides TTY check completely", async () => {
    // Should not throw when autoApprove=true regardless of TTY status
    await expect(confirmOrThrow("Test operation", true)).resolves.toBeUndefined();
  });

  it("returns immediately without readline call when autoApprove is true", async () => {
    const input = { isTTY: false };
    const output = { isTTY: false };

    // When autoApprove=true, confirmOrThrow returns early without calling readline
    await expect(
      confirmOrThrow("Test message", true, input as any, output as any)
    ).resolves.toBeUndefined();
  });
});

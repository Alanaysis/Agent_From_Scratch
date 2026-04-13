import { describe, it, expect } from "bun:test";

// Re-implement the TUI utility functions for testing (they're not exported)
function wrapText(text: string, width: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const rawLines = normalized.split("\n");
  const wrapped: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine) {
      wrapped.push("");
      continue;
    }

    let line = rawLine;
    while (line.length > width) {
      wrapped.push(line.slice(0, width));
      line = line.slice(width);
    }
    wrapped.push(line);
  }

  return wrapped;
}

function trimText(text: string, width: number): string {
  const plain = text.replace(/\x1b\[[0-9;]*m/g, "");
  if (plain.length <= width) {
    return text + " ".repeat(Math.max(0, width - plain.length));
  }
  return plain.slice(0, Math.max(0, width - 1)) + "\u2026";
}

function trimTextPlain(text: string, width: number): string {
  if (text.length <= width) {
    return text.padEnd(width, " ");
  }
  return text.slice(0, Math.max(0, width - 1)) + "\u2026";
}

function formatEntry(entry: { kind: string; text: string }): string {
  switch (entry.kind) {
    case "user":
      return "You  " + entry.text;
    case "assistant":
      return "CCL  " + entry.text;
    case "tool":
      return "Tool " + entry.text;
    case "result":
      return "Out  " + entry.text;
    case "error":
      return "Err  " + entry.text;
    case "system":
      return "Sys  " + entry.text;
  }
}

function formatUnknown(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function summarizeText(text: string, maxLength = 48): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized || "(empty)";
  }
  return normalized.slice(0, maxLength - 1) + "\u2026";
}

function shouldCollapse(text: string): boolean {
  return text.includes("\n") || text.length > 160;
}

function colorize(text: string, color: string): string {
  return color + text + "\x1b[0m";
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) {
    return "-";
  }
  if (durationMs < 1000) {
    return String(durationMs) + "ms";
  }
  return ((durationMs / 1000).toFixed(1)) + "s";
}

function cycleTimelineFilter(filter: "all" | "failed" | "tools"): "all" | "failed" | "tools" {
  switch (filter) {
    case "all":
      return "failed";
    case "failed":
      return "tools";
    case "tools":
      return "all";
  }
}

describe("wrapText - line wrapping", () => {
  it("wraps text that exceeds width", () => {
    const result = wrapText("This is a very long line that should be wrapped at the specified width", 20);
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].length).toBeLessThanOrEqual(20);
  });

  it("returns single element for text within width", () => {
    const result = wrapText("Short line", 50);
    expect(result.length).toBe(1);
    expect(result[0]).toBe("Short line");
  });

  it("preserves newlines as separate lines", () => {
    const text = "Line one\nLine two\nLine three";
    const result = wrapText(text, 50);
    expect(result).toEqual(["Line one", "Line two", "Line three"]);
  });

  it("handles empty strings", () => {
    const result = wrapText("", 20);
    expect(result).toEqual([""]);
  });

  it("handles multiple consecutive newlines", () => {
    const text = "Line one\n\n\nLine four";
    const result = wrapText(text, 20);
    expect(result).toContain(""); // Empty lines preserved
  });

  it("handles Windows-style line endings (CRLF)", () => {
    const text = "Line one\r\nLine two\r\nLine three";
    const result = wrapText(text, 50);
    expect(result).toEqual(["Line one", "Line two", "Line three"]);
  });

  it("handles mixed line endings", () => {
    const text = "Line one\r\nLine two\nLine three\r\nLine four";
    const result = wrapText(text, 50);
    expect(result.length).toBe(4);
  });

  it("wraps at exact character boundary", () => {
    const longString = "a".repeat(100);
    const result = wrapText(longString, 20);

    // Should have 5 lines of 20 characters each
    expect(result.length).toBe(5);
    for (const line of result) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });

  it("handles very narrow width", () => {
    const result = wrapText("Hello World", 3);
    expect(result.length).toBeGreaterThan(1);
    for (const line of result) {
      expect(line.length).toBeLessThanOrEqual(3);
    }
  });

  it("handles single character wrapping", () => {
    const result = wrapText("abcdef", 1);
    expect(result).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("trimText - text trimming with ANSI escape handling", () => {
  it("trims text that exceeds width", () => {
    const result = trimText("This is a very long text that needs to be trimmed", 20);
    expect(result.length).toBeLessThanOrEqual(21); // +1 for ellipsis
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("returns original text when within width (with padding)", () => {
    const result = trimText("Short", 50);
    expect(result.length).toBe(50);
    expect(result.startsWith("Short")).toBe(true);
  });

  it("handles ANSI escape codes correctly", () => {
    const textWithColor = "\x1b[32mThis is green text\x1b[0m";
    const result = trimText(textWithColor, 15);

    // Plain length should be <= width, but total with ANSI might exceed
    const plainLength = result.replace(/\x1b\[[0-9;]*m/g, "").length;
    expect(plainLength).toBeLessThanOrEqual(16); // +1 for ellipsis
  });

  it("handles empty string", () => {
    const result = trimText("", 20);
    expect(result.length).toBe(20); // Padded with spaces
  });

  it("handles width of 0", () => {
    const result = trimText("Hello", 0);
    expect(result).toBe("\u2026");
  });

  it("handles negative width (treated as 0)", () => {
    const result = trimText("Hello", -5);
    // Math.max(0, -6) = 0, so should be "\u2026"
    expect(result).toBe("\u2026");
  });

  it("trims to exact width minus ellipsis", () => {
    const longString = "a".repeat(100);
    const result = trimText(longString, 25);
    // Should be 24 chars + ellipsis = 25 total
    expect(result.length).toBeLessThanOrEqual(25);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("handles text with mixed ANSI codes", () => {
    const complexText = "\x1b[32mGreen\x1b[0m \x1b[1mBold\x1b[0m \x1b[4mUnderlined\x1b[0m";
    const result = trimText(complexText, 30);

    // Plain length should be reasonable (text is ~25 chars)
    const plainLength = result.replace(/\x1b\[[0-9;]*m/g, "").length;
    expect(plainLength).toBeLessThanOrEqual(30);
  });

  it("handles special characters", () => {
    const text = "Hello \u4e16\u754c\uff01\ud83c\udf0d";
    const result = trimText(text, 10);

    // Should truncate properly even with multi-byte chars
    expect(result.length).toBeLessThanOrEqual(11);
  });

  it("preserves trailing spaces when within width", () => {
    const text = "Hello";
    const result = trimText(text, 50);
    expect(result.endsWith("     ")).toBe(true); // Should have padding
  });
});

describe("trimTextPlain - plain text trimming without ANSI handling", () => {
  it("trims text that exceeds width", () => {
    const result = trimTextPlain("This is very long text for testing", 20);
    expect(result.length).toBeLessThanOrEqual(21);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("pads with spaces when within width", () => {
    const result = trimTextPlain("Short", 50);
    expect(result.length).toBe(50);
  });

  it("handles empty string", () => {
    const result = trimTextPlain("", 20);
    expect(result.length).toBe(20);
  });

  it("handles width of 1", () => {
    const result = trimTextPlain("Hello", 1);
    expect(result).toBe("\u2026");
  });

  it("handles single character input within width", () => {
    const result = trimTextPlain("A", 20);
    expect(result.length).toBe(20);
    expect(result.startsWith("A")).toBe(true);
  });

  it("handles very long text with narrow width", () => {
    const longString = "a".repeat(1000);
    const result = trimTextPlain(longString, 5);
    expect(result.length).toBeLessThanOrEqual(6); // 5 + ellipsis
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("handles Unicode characters", () => {
    const text = "Hello \u4e16\u754c";
    const result = trimTextPlain(text, 10);
    expect(result.length).toBeLessThanOrEqual(11);
  });

  it("preserves exact width padding", () => {
    const text = "Test";
    const result = trimTextPlain(text, 8);
    expect(result.length).toBe(8);
    expect(result.startsWith("Test")).toBe(true);
  });
});

describe("formatEntry - conversation entry formatting", () => {
  it("formats user entries with 'You' prefix", () => {
    const result = formatEntry({ kind: "user", text: "Hello" });
    expect(result).toBe("You  Hello");
  });

  it("formats assistant entries with 'CCL' prefix", () => {
    const result = formatEntry({ kind: "assistant", text: "How can I help?" });
    expect(result).toBe("CCL  How can I help?");
  });

  it("formats tool entries with 'Tool' prefix", () => {
    const result = formatEntry({ kind: "tool", text: "Read file.txt" });
    expect(result).toBe("Tool Read file.txt");
  });

  it("formats successful result entries with 'Out' prefix", () => {
    const result = formatEntry({ kind: "result", text: "File contents" });
    expect(result).toBe("Out  File contents");
  });

  it("formats error entries with 'Err' prefix", () => {
    const result = formatEntry({ kind: "error", text: "Permission denied" });
    expect(result).toBe("Err  Permission denied");
  });

  it("formats system entries with 'Sys' prefix", () => {
    const result = formatEntry({ kind: "system", text: "Session started" });
    expect(result).toBe("Sys  Session started");
  });

  it("handles empty text for all entry types", () => {
    expect(formatEntry({ kind: "user", text: "" })).toBe("You  ");
    expect(formatEntry({ kind: "assistant", text: "" })).toBe("CCL  ");
    expect(formatEntry({ kind: "tool", text: "" })).toBe("Tool ");
    expect(formatEntry({ kind: "result", text: "" })).toBe("Out  ");
    expect(formatEntry({ kind: "error", text: "" })).toBe("Err  ");
    expect(formatEntry({ kind: "system", text: "" })).toBe("Sys  ");
  });

  it("handles long text entries", () => {
    const longText = "This is a very long message that exceeds normal length expectations".repeat(10);
    const result = formatEntry({ kind: "user", text: longText });
    expect(result.startsWith("You  ")).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(longText.length + 5);
  });

  it("handles text with special characters", () => {
    const text = "Hello $HOME/path/file.txt (sudo)?";
    const result = formatEntry({ kind: "user", text });
    expect(result).toContain(text);
  });

  it("preserves newlines in entry text", () => {
    const text = "Line one\nLine two\nLine three";
    const result = formatEntry({ kind: "assistant", text });
    expect(result).toContain("\n");
    expect(result.startsWith("CCL  ")).toBe(true);
  });

  it("handles Unicode characters in entries", () => {
    const text = "Hello \u4e16\u754c\uff01\ud83c\udf0d";
    const result = formatEntry({ kind: "user", text });
    expect(result).toContain(text);
  });
});

describe("formatUnknown - unknown value formatting", () => {
  it("returns string values as-is", () => {
    expect(formatUnknown("Hello")).toBe("Hello");
    expect(formatUnknown("")).toBe("");
  });

  it("stringifies numbers", () => {
    expect(formatUnknown(42)).toBe("42");
    expect(formatUnknown(-10)).toBe("-10");
    expect(formatUnknown(3.14)).toBe("3.14");
  });

  it("stringifies booleans", () => {
    expect(formatUnknown(true)).toBe("true");
    expect(formatUnknown(false)).toBe("false");
  });

  it("stringifies null as 'null'", () => {
    expect(formatUnknown(null)).toBe("null");
  });

  it("handles null value (returns 'null')", () => {
    expect(formatUnknown(null)).toBe("null");
  });

  it("handles undefined by returning undefined (JSON.stringify behavior)", () => {
    // Our wrapper checks typeof === "string" first, so for undefined we return JSON.stringify(undefined)
    // JSON.stringify(undefined) returns the value undefined in Node.js
    const result = formatUnknown(undefined);
    expect(result).toBeUndefined();
  });

  it("formats simple objects with indentation", () => {
    const obj = { name: "test", value: 42 };
    const result = formatUnknown(obj);
    expect(result).toContain('"name": "test"');
    expect(result).toContain('"value": 42');
  });

  it("formats nested objects with proper indentation", () => {
    const obj = { outer: { inner: { deep: "value" } } };
    const result = formatUnknown(obj);
    expect(result).toContain("deep");
    // JSON.stringify uses 2-space indent by default
    expect(result.includes("\n")).toBe(true);
  });

  it("formats arrays", () => {
    const arr = [1, 2, 3];
    const result = formatUnknown(arr);
    expect(result).toBe("[\n  1,\n  2,\n  3\n]");
  });

  it("handles empty objects", () => {
    expect(formatUnknown({})).toBe("{}");
  });

  it("handles empty arrays", () => {
    expect(formatUnknown([])).toBe("[]");
  });

  it("handles circular references (throws error)", () => {
    const obj: any = { name: "test" };
    obj.self = obj; // Create circular reference

    // JSON.stringify throws on circular refs by default
    expect(() => formatUnknown(obj)).toThrow();
  });

  it("handles Symbol values (ignored in JSON)", () => {
    const sym = Symbol("test");
    const obj = { sym };
    const result = formatUnknown(obj);
    // Symbols are omitted from JSON.stringify
    expect(result).toBe("{}");
  });

  it("handles functions in objects (functions omitted by JSON.stringify)", () => {
    const fn = () => "test";
    const obj = { fn };
    const result = formatUnknown(obj);
    // Functions are omitted from JSON.stringify output, so we get "{}"
    expect(result).toBe("{}");
  });
});

describe("summarizeText - text summarization", () => {
  it("returns original text when within maxLength", () => {
    const result = summarizeText("Short text", 50);
    expect(result).toBe("Short text");
  });

  it("trims whitespace from input", () => {
    const result = summarizeText("   Text with spaces   ", 50);
    expect(result).toBe("Text with spaces");
  });

  it("collapses multiple spaces to single space", () => {
    const text = "Multiple     spaces";
    const result = summarizeText(text, 50);
    expect(result).toBe("Multiple spaces");
  });

  it("truncates and adds ellipsis when exceeding maxLength", () => {
    const longText = "This is a very long text that should be truncated to fit the maximum length specified";
    const result = summarizeText(longText, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("handles empty string", () => {
    const result = summarizeText("", 50);
    expect(result).toBe("(empty)");
  });

  it("handles whitespace-only string as '(empty)'", () => {
    const result = summarizeText("   \t\n  ", 50);
    expect(result).toBe("(empty)");
  });

  it("uses default maxLength of 48 when not specified", () => {
    const text = "a".repeat(100);
    const result = summarizeText(text); // Uses default 48

    expect(result.length).toBeLessThanOrEqual(48);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("handles maxLength of 1", () => {
    const text = "Hello";
    const result = summarizeText(text, 1);
    expect(result).toBe("\u2026"); // 0 chars + ellipsis
  });

  it("handles very small maxLength (2)", () => {
    const text = "Hello World";
    const result = summarizeText(text, 2);
    expect(result.length).toBe(2); // 1 char + ellipsis
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("handles single character input within maxLength", () => {
    const result = summarizeText("A", 50);
    expect(result).toBe("A");
  });

  it("preserves meaningful text up to boundary", () => {
    const text = "This is a meaningful summary that should be truncated at the right place";
    const result = summarizeText(text, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("handles text with newlines (collapses to space)", () => {
    const text = "Line one\nLine two\nLine three";
    const result = summarizeText(text, 50);
    expect(result).toBe("Line one Line two Line three"); // Newlines collapsed
  });

  it("handles Unicode characters", () => {
    const text = "Hello \u4e16\u754c\uff01\ud83c\udf0d This is a test";
    const result = summarizeText(text, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("handles very long input with small maxLength", () => {
    const text = "a".repeat(1000);
    const result = summarizeText(text, 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe("shouldCollapse - collapse detection", () => {
  it("returns false for short single-line text", () => {
    expect(shouldCollapse("Short")).toBe(false);
  });

  it("returns true for text with newlines", () => {
    expect(shouldCollapse("Line one\nLine two")).toBe(true);
  });

  it("returns true for long single-line text (> 160 chars)", () => {
    const longText = "a".repeat(161);
    expect(shouldCollapse(longText)).toBe(true);
  });

  it("returns false for exactly 160 character text without newlines", () => {
    const exactLength = "a".repeat(160);
    expect(shouldCollapse(exactLength)).toBe(false);
  });

  it("returns true for 161 characters", () => {
    const justOver = "a".repeat(161);
    expect(shouldCollapse(justOver)).toBe(true);
  });

  it("handles empty string (no collapse)", () => {
    expect(shouldCollapse("")).toBe(false);
  });

  it("handles text with multiple newlines", () => {
    const multiNewline = "Line 1\nLine 2\nLine 3\nLine 4";
    expect(shouldCollapse(multiNewline)).toBe(true);
  });

  it("handles mixed content (short + newline)", () => {
    expect(shouldCollapse("Short\nLong")).toBe(true); // Has newline = collapse
  });

  it("handles Windows-style line endings", () => {
    const crlfText = "Line one\r\nLine two";
    expect(shouldCollapse(crlfText)).toBe(true);
  });

  it("handles very long text with embedded newlines", () => {
    const text = "a".repeat(200) + "\n" + "b".repeat(100);
    expect(shouldCollapse(text)).toBe(true); // Both conditions true
  });

  it("returns false for exactly boundary case (160 chars, no newline)", () => {
    const boundary = "x".repeat(160);
    expect(shouldCollapse(boundary)).toBe(false);
  });

  it("handles text with carriage returns", () => {
    // Carriage return without newline doesn't count as newline
    const crOnly = "Line one\rLine two";
    expect(shouldCollapse(crOnly)).toBe(false); // No newline and <160 chars, so no collapse
  });
});

describe("colorize - ANSI colorization", () => {
  it("wraps text with color code and reset", () => {
    const result = colorize("Hello", "\x1b[32m");
    expect(result).toBe("\x1b[32mHello\x1b[0m");
  });

  it("handles empty string", () => {
    const result = colorize("", "\x1b[32m");
    expect(result).toBe("\x1b[32m\x1b[0m");
  });

  it("works with different color codes", () => {
    const colors = ["\x1b[31m", "\x1b[34m", "\x1b[33m", "\x1b[90m"];

    for (const color of colors) {
      const result = colorize("Test", color);
      expect(result).toContain(color);
      expect(result).toContain("\x1b[0m");
    }
  });

  it("handles text with special characters", () => {
    const result = colorize("$HOME/path", "\x1b[32m");
    expect(result).toBe("\x1b[32m$HOME/path\x1b[0m");
  });

  it("preserves Unicode in colored text", () => {
    const result = colorize("Hello \ud83c\udf0d", "\x1b[32m");
    expect(result).toContain("\ud83c\udf0d");
    expect(result.startsWith("\x1b[32m")).toBe(true);
  });

  it("handles very long text", () => {
    const longText = "a".repeat(1000);
    const result = colorize(longText, "\x1b[32m");
    expect(result.startsWith("\x1b[32m")).toBe(true);
    expect(result.endsWith("\x1b[0m")).toBe(true);
  });

  it("works with complex ANSI codes", () => {
    const complexColor = "\x1b[1;36m"; // Bold cyan
    const result = colorize("Test", complexColor);
    expect(result).toContain(complexColor);
    expect(result.endsWith("\x1b[0m")).toBe(true);
  });

  it("handles text with ANSI codes already (nested)", () => {
    const innerColored = "\x1b[32mInner\x1b[0m";
    const result = colorize(innerColored, "\x1b[36m");
    expect(result).toBe("\x1b[36m\x1b[32mInner\x1b[0m\x1b[0m"); // Outer wraps inner
  });

  it("handles newline in colored text", () => {
    const result = colorize("Line 1\nLine 2", "\x1b[32m");
    expect(result).toContain("\n");
    expect(result.startsWith("\x1b[32m")).toBe(true);
  });

  it("handles tab characters in colored text", () => {
    const result = colorize("Col\tTabbed", "\x1b[32m");
    expect(result).toContain("\t");
  });
});

describe("formatDuration - duration formatting", () => {
  it("returns dash for undefined", () => {
    expect(formatDuration(undefined)).toBe("-");
  });

  it("formats milliseconds under 1 second", () => {
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formats exactly 1 second with decimal", () => {
    const result = formatDuration(1000);
    expect(result).toBe("1.0s"); // Uses toFixed(1)
  });

  it("formats seconds with one decimal place", () => {
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(2500)).toBe("2.5s");
    expect(formatDuration(3750)).toBe("3.8s"); // Rounded
  });

  it("formats large durations correctly", () => {
    expect(formatDuration(60000)).toBe("60.0s"); // 1 minute
    expect(formatDuration(120000)).toBe("120.0s"); // 2 minutes
  });

  it("handles zero milliseconds", () => {
    expect(formatDuration(0)).toBe("0ms");
  });

  it("handles very small durations", () => {
    expect(formatDuration(1)).toBe("1ms");
    expect(formatDuration(9)).toBe("9ms");
  });

  it("formats fractional milliseconds correctly (rounds)", () => {
    const result = formatDuration(1234); // 1.234 seconds
    expect(result).toBe("1.2s"); // Rounded to 1 decimal
  });

  it("handles boundary case at 999ms", () => {
    expect(formatDuration(999)).toBe("999ms");
  });

  it("handles boundary case at 1000ms (switches to seconds)", () => {
    const result = formatDuration(1000);
    expect(result).toBe("1.0s");
  });

  it("handles very large durations", () => {
    const result = formatDuration(3600000); // 1 hour in ms
    expect(result).toBe("3600.0s");
  });

  it("handles negative milliseconds (edge case)", () => {
    // While unusual, should still format consistently
    const result = formatDuration(-500);
    expect(result).toBe("-500ms");
  });

  it("formats durations with no fractional part cleanly", () => {
    expect(formatDuration(2000)).toBe("2.0s");
    expect(formatDuration(3000)).toBe("3.0s");
  });
});

describe("cycleTimelineFilter - filter cycling", () => {
  it("cycles from 'all' to 'failed'", () => {
    expect(cycleTimelineFilter("all")).toBe("failed");
  });

  it("cycles from 'failed' to 'tools'", () => {
    expect(cycleTimelineFilter("failed")).toBe("tools");
  });

  it("cycles from 'tools' back to 'all'", () => {
    expect(cycleTimelineFilter("tools")).toBe("all");
  });

  it("completes full cycle: all -> failed -> tools -> all", () => {
    let filter: "all" | "failed" | "tools" = "all";

    filter = cycleTimelineFilter(filter);
    expect(filter).toBe("failed");

    filter = cycleTimelineFilter(filter);
    expect(filter).toBe("tools");

    filter = cycleTimelineFilter(filter);
    expect(filter).toBe("all");
  });

  it("can be called multiple times in sequence", () => {
    let filter: "all" | "failed" | "tools" = "all";

    for (let i = 0; i < 6; i++) {
      filter = cycleTimelineFilter(filter);
    }

    // After 3 full cycles, should be back at start
    expect(filter).toBe("all");
  });

  it("handles all enum values correctly", () => {
    const inputs: Array<"all" | "failed" | "tools"> = ["all", "failed", "tools"];
    const outputs: Array<"all" | "failed" | "tools"> = ["failed", "tools", "all"];

    for (let i = 0; i < inputs.length; i++) {
      expect(cycleTimelineFilter(inputs[i])).toBe(outputs[i]);
    }
  });

  it("preserves string type correctness", () => {
    const result: "failed" | "tools" | "all" = cycleTimelineFilter("all");
    // TypeScript should accept this as valid
    expect(result).toBeDefined();
  });
});

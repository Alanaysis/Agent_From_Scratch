import { describe, it, expect } from "bun:test";
import {
  parseCleanupCommandOptions,
  parseSessionsCommandOptions,
} from "../../../app/headless";

describe("parseCleanupCommandOptions", () => {
  it("parses --keep option with valid number", () => {
    const result = parseCleanupCommandOptions(["--keep", "5"]);
    expect(result.keep).toBe(5);
    expect(result.olderThanDays).toBeUndefined();
    expect(result.dryRun).toBe(false);
  });

  it("parses --older-than option with valid number", () => {
    const result = parseCleanupCommandOptions(["--older-than", "30"]);
    expect(result.keep).toBeUndefined();
    expect(result.olderThanDays).toBe(30);
    expect(result.dryRun).toBe(false);
  });

  it("parses --dry-run flag", () => {
    const result = parseCleanupCommandOptions(["--keep", "5", "--dry-run"]);
    expect(result.keep).toBe(5);
    expect(result.dryRun).toBe(true);
  });

  it("parses --status option with 'ready'", () => {
    const result = parseCleanupCommandOptions([
      "--keep",
      "10",
      "--status",
      "ready",
    ]);
    expect(result.status).toBe("ready");
  });

  it("parses --status option with 'needs_attention'", () => {
    const result = parseCleanupCommandOptions([
      "--older-than",
      "7",
      "--status",
      "needs_attention",
    ]);
    expect(result.status).toBe("needs_attention");
  });

  it("parses all options together", () => {
    const result = parseCleanupCommandOptions([
      "--keep",
      "5",
      "--older-than",
      "14",
      "--status",
      "ready",
      "--dry-run",
    ]);
    expect(result.keep).toBe(5);
    expect(result.olderThanDays).toBe(14);
    expect(result.status).toBe("ready");
    expect(result.dryRun).toBe(true);
  });

  it("throws error for invalid --keep value (non-numeric)", () => {
    expect(() =>
      parseCleanupCommandOptions(["--keep", "abc"]),
    ).toThrow(/requires a non-negative number/);
  });

  it("throws error for negative --keep value", () => {
    expect(() =>
      parseCleanupCommandOptions(["--keep", "-1"]),
    ).toThrow(/requires a non-negative number/);
  });

  it("throws error for invalid --older-than value (non-numeric)", () => {
    expect(() =>
      parseCleanupCommandOptions(["--older-than", "xyz"]),
    ).toThrow(/requires a non-negative number/);
  });

  it("throws error for negative --older-than value", () => {
    expect(() =>
      parseCleanupCommandOptions(["--older-than", "-5"]),
    ).toThrow(/requires a non-negative number/);
  });

  it("throws error for invalid --status value", () => {
    expect(() =>
      parseCleanupCommandOptions([
        "--keep",
        "10",
        "--status",
        "invalid_status",
      ]),
    ).toThrow(/requires.*ready.*needs_attention/i);
  });

  it("throws error for unknown option", () => {
    expect(() =>
      parseCleanupCommandOptions(["--unknown-option"]),
    ).toThrow(/Unknown cleanup-sessions option/);
  });

  it("throws error when neither --keep nor --older-than provided", () => {
    expect(() =>
      parseCleanupCommandOptions([]),
    ).toThrow(/requires.*--keep.*or.*--older-than/i);
  });

  it("throws error for zero value (valid but edge case)", () => {
    const result = parseCleanupCommandOptions(["--keep", "0"]);
    expect(result.keep).toBe(0); // Zero is valid
  });

  it("handles --dry-run without other options (should throw about missing keep/older-than)", () => {
    expect(() =>
      parseCleanupCommandOptions(["--dry-run"]),
    ).toThrow(/requires.*--keep.*or.*--older-than/i);
  });

  it("parses --status without keeping or olderThan (uses other options)", () => {
    const result = parseCleanupCommandOptions([
      "--keep",
      "5",
      "--status",
      "ready",
    ]);
    expect(result.keep).toBe(5);
    expect(result.status).toBe("ready");
  });

  it("handles options in different order", () => {
    const result = parseCleanupCommandOptions([
      "--dry-run",
      "--keep",
      "3",
      "--older-than",
      "7",
      "--status",
      "needs_attention",
    ]);
    expect(result.keep).toBe(3);
    expect(result.olderThanDays).toBe(7);
    expect(result.status).toBe("needs_attention");
    expect(result.dryRun).toBe(true);
  });

  it("accepts float value for --keep (Number.isFinite allows floats)", () => {
    const result = parseCleanupCommandOptions(["--keep", "5.5"]);
    expect(result.keep).toBe(5.5); // Float is accepted since Number("5.5") passes isFinite check
  });

  it("handles --older-than with large value", () => {
    const result = parseCleanupCommandOptions(["--older-than", "365"]);
    expect(result.olderThanDays).toBe(365);
  });

  it("accepts empty string for --keep (Number('') is 0 which is valid)", () => {
    const result = parseCleanupCommandOptions(["--keep", ""]);
    expect(result.keep).toBe(0); // Number("") converts to 0, not NaN
  });
});

describe("parseSessionsCommandOptions", () => {
  it("parses --limit option with valid number", () => {
    const result = parseSessionsCommandOptions(["--limit", "10"]);
    expect(result.limit).toBe(10);
    expect(result.status).toBeUndefined();
  });

  it("parses --status option with 'ready'", () => {
    const result = parseSessionsCommandOptions([
      "--status",
      "ready",
    ]);
    expect(result.status).toBe("ready");
    expect(result.limit).toBeUndefined();
  });

  it("parses --status option with 'needs_attention'", () => {
    const result = parseSessionsCommandOptions([
      "--status",
      "needs_attention",
    ]);
    expect(result.status).toBe("needs_attention");
  });

  it("parses both options together", () => {
    const result = parseSessionsCommandOptions(["--limit", "5", "--status", "ready"]);
    expect(result.limit).toBe(5);
    expect(result.status).toBe("ready");
  });

  it("returns empty object when no options provided", () => {
    const result = parseSessionsCommandOptions([]);
    expect(result).toEqual({ limit: undefined, status: undefined });
  });

  it("throws error for invalid --limit value (non-numeric)", () => {
    expect(() =>
      parseSessionsCommandOptions(["--limit", "abc"]),
    ).toThrow(/requires a non-negative number/);
  });

  it("throws error for negative --limit value", () => {
    expect(() =>
      parseSessionsCommandOptions(["--limit", "-1"]),
    ).toThrow(/requires a non-negative number/);
  });

  it("throws error for invalid --status value", () => {
    expect(() =>
      parseSessionsCommandOptions([
        "--status",
        "invalid_status",
      ]),
    ).toThrow(/requires.*ready.*needs_attention/i);
  });

  it("throws error for unknown option", () => {
    expect(() =>
      parseSessionsCommandOptions(["--unknown"]),
    ).toThrow(/Unknown sessions option/);
  });

  it("handles --limit with zero (valid edge case)", () => {
    const result = parseSessionsCommandOptions(["--limit", "0"]);
    expect(result.limit).toBe(0);
  });

  it("handles --limit with large value", () => {
    const result = parseSessionsCommandOptions(["--limit", "1000"]);
    expect(result.limit).toBe(1000);
  });

  it("parses options in different order", () => {
    const result = parseSessionsCommandOptions([
      "--status",
      "needs_attention",
      "--limit",
      "20",
    ]);
    expect(result.limit).toBe(20);
    expect(result.status).toBe("needs_attention");
  });

  it("accepts float value for --limit (Number.isFinite allows floats)", () => {
    const result = parseSessionsCommandOptions(["--limit", "5.5"]);
    expect(result.limit).toBe(5.5); // Float is accepted since Number("5.5") passes isFinite check
  });

  it("accepts empty string for --limit (Number('') is 0 which is valid)", () => {
    const result = parseSessionsCommandOptions(["--limit", ""]);
    expect(result.limit).toBe(0); // Number("") converts to 0, not NaN
  });

  it("handles --status value with extra whitespace (should fail exact match)", () => {
    expect(() =>
      parseSessionsCommandOptions([
        "--status",
        " ready ", // has spaces
      ]),
    ).toThrow(/requires.*ready.*needs_attention/i);
  });

  it("handles case sensitivity of status values", () => {
    expect(() =>
      parseSessionsCommandOptions(["--status", "Ready"]), // capitalized
    ).toThrow(/requires.*ready.*needs_attention/i);
  });

  it("handles multiple --limit flags (last one wins)", () => {
    const result = parseSessionsCommandOptions([
      "--limit",
      "5",
      "--limit",
      "10",
    ]);
    expect(result.limit).toBe(10); // last value wins
  });

  it("handles multiple --status flags (last one wins)", () => {
    const result = parseSessionsCommandOptions([
      "--status",
      "ready",
      "--status",
      "needs_attention",
    ]);
    expect(result.status).toBe("needs_attention"); // last value wins
  });

  it("handles --limit with spaces in number string", () => {
    const result = parseSessionsCommandOptions(["--limit", " 10 "]);
    expect(result.limit).toBe(10); // Number() trims automatically
  });
});

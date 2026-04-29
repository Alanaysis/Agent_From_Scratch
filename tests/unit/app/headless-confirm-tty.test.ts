import { describe, it, expect, vi, beforeEach } from "bun:test";

// Mock process.stdin and process.stdout BEFORE any other imports
const mockStdin = { isTTY: true };
const mockStdout = { isTTY: true };

vi.mock("process", () => ({
  stdin: mockStdin,
  stdout: mockStdout,
}));

// Static mock declarations for Bun - these run at load time
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

describe("confirmWithSessionRule - TTY readline path", () => {
  beforeEach(() => {
    mockQuestion.mockClear();
    mockClose.mockClear();
  });

  it("accepts 'y' answer for once permission", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Read" } as any;
    await expect(
      confirmWithSessionRule("Run command?", false, mockTool, {}, {} as any)
    ).resolves.toBeUndefined();
  });

  it("accepts 'Y' answer (case insensitive)", async () => {
    mockQuestion.mockResolvedValueOnce("Y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Shell" } as any;
    await expect(
      confirmWithSessionRule("Execute?", false, mockTool, {}, {} as any)
    ).resolves.toBeUndefined();
  });

  it("accepts 'yes' answer", async () => {
    mockQuestion.mockResolvedValueOnce("yes");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Write" } as any;
    await expect(
      confirmWithSessionRule("Write file?", false, mockTool, {}, {} as any)
    ).resolves.toBeUndefined();
  });

  it("accepts 'a' answer for session permission", async () => {
    mockQuestion.mockResolvedValueOnce("a");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    let stateUpdated = false;
    const mockContext = {
      cwd: "/tmp",
      setAppState: () => { stateUpdated = true; },
    } as any;

    const mockTool = { name: "Read", permissionLevel: "tool_use" as const };
    await expect(
      confirmWithSessionRule("Allow session?", false, mockTool, {}, mockContext)
    ).resolves.toBeUndefined();

    expect(stateUpdated).toBe(true);
  });

  it("accepts 'always' answer for permanent permission", async () => {
    mockQuestion.mockResolvedValueOnce("always");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    let stateUpdated = false;
    const mockContext = {
      cwd: "/tmp",
      setAppState: () => { stateUpdated = true; },
    } as any;

    const mockTool = { name: "Edit", permissionLevel: "tool_use" as const };
    await expect(
      confirmWithSessionRule("Allow always?", false, mockTool, {}, mockContext)
    ).resolves.toBeUndefined();

    expect(stateUpdated).toBe(true);
  });

  it("rejects 'n' answer", async () => {
    mockQuestion.mockResolvedValueOnce("n");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Read" } as any;
    await expect(
      confirmWithSessionRule("Cancel?", false, mockTool, {}, {} as any)
    ).rejects.toThrow(/cancelled/i);
  });

  it("rejects 'no' answer", async () => {
    mockQuestion.mockResolvedValueOnce("no");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Shell" } as any;
    await expect(
      confirmWithSessionRule("Stop?", false, mockTool, {}, {} as any)
    ).rejects.toThrow(/cancelled/i);
  });

  it("rejects empty answer", async () => {
    mockQuestion.mockResolvedValueOnce("");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Read" } as any;
    await expect(
      confirmWithSessionRule("Empty?", false, mockTool, {}, {} as any)
    ).rejects.toThrow(/cancelled/i);
  });

  it("closes readline on success", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Read" } as any;
    await expect(
      confirmWithSessionRule("Confirm?", false, mockTool, {}, {} as any)
    ).resolves.toBeUndefined();

    expect(mockClose).toHaveBeenCalled();
  });

  it("closes readline on error", async () => {
    mockQuestion.mockResolvedValueOnce("n");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Read" } as any;
    await expect(
      confirmWithSessionRule("Cancel?", false, mockTool, {}, {} as any)
    ).rejects.toThrow();

    expect(mockClose).toHaveBeenCalled();
  });

  it("handles long message", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const longMessage = "A".repeat(1000);
    const mockTool = { name: "Read" } as any;
    await expect(
      confirmWithSessionRule(longMessage, false, mockTool, {}, {} as any)
    ).resolves.toBeUndefined();
  });

  it("handles unicode message", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Read" } as any;
    await expect(
      confirmWithSessionRule("Unicode: \u00e9\u00e8\u00ea", false, mockTool, {}, {} as any)
    ).resolves.toBeUndefined();
  });

  it("handles special characters in message", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Read" } as any;
    await expect(
      confirmWithSessionRule("Special!@#$%", false, mockTool, {}, {} as any)
    ).resolves.toBeUndefined();
  });

  it("handles message with newlines", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Read" } as any;
    await expect(
      confirmWithSessionRule("Line 1\nLine 2", false, mockTool, {}, {} as any)
    ).resolves.toBeUndefined();
  });

  it("calls question with correct prompt format", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmWithSessionRule } = await import("../../../app/headless");

    const mockTool = { name: "Read" } as any;
    await expect(
      confirmWithSessionRule("Test?", false, mockTool, {}, {} as any)
    ).resolves.toBeUndefined();

    expect(mockQuestion).toHaveBeenCalledWith("Test? [y] once / [a] session / [N] ");
  });
});

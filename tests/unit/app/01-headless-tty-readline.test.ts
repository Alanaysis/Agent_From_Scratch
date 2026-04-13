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

describe("confirmOrThrow - TTY readline path", () => {
  beforeEach(() => {
    mockQuestion.mockClear();
    mockClose.mockClear();
  });

  it("accepts 'y' answer in TTY mode", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    // Update the mocked process.stdin/stdout before import
    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Confirm?", false)).resolves.toBeUndefined();
    expect(mockQuestion).toHaveBeenCalledWith("Confirm? [y/N] ");
  });

  it("accepts 'Y' answer in TTY mode (case insensitive)", async () => {
    mockQuestion.mockResolvedValueOnce("Y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Confirm?", false)).resolves.toBeUndefined();
  });

  it("accepts 'yes' answer in TTY mode", async () => {
    mockQuestion.mockResolvedValueOnce("yes");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Confirm?", false)).resolves.toBeUndefined();
  });

  it("accepts 'YES' answer in TTY mode", async () => {
    mockQuestion.mockResolvedValueOnce("YES");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Confirm?", false)).resolves.toBeUndefined();
  });

  it("rejects 'n' answer in TTY mode", async () => {
    mockQuestion.mockResolvedValueOnce("n");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Confirm?", false)).rejects.toThrow(/Operation cancelled/);
  });

  it("rejects 'no' answer in TTY mode", async () => {
    mockQuestion.mockResolvedValueOnce("no");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Confirm?", false)).rejects.toThrow(/Operation cancelled/);
  });

  it("rejects empty answer in TTY mode", async () => {
    mockQuestion.mockResolvedValueOnce("");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Confirm?", false)).rejects.toThrow(/Operation cancelled/);
  });

  it("rejects 'maybe' answer in TTY mode", async () => {
    mockQuestion.mockResolvedValueOnce("maybe");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Confirm?", false)).rejects.toThrow(/Operation cancelled/);
  });

  it("handles long message in TTY mode", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const longMessage = "A".repeat(1000);
    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow(longMessage, false)).resolves.toBeUndefined();
  });

  it("handles unicode characters in message", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(
      confirmOrThrow("Confirm unicode: \u00e9\u00e8\u00ea", false)
    ).resolves.toBeUndefined();
  });

  it("handles special characters in message", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(
      confirmOrThrow("Confirm action with special chars!@#$%", false)
    ).resolves.toBeUndefined();
  });

  it("handles empty message", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("", false)).resolves.toBeUndefined();
  });

  it("closes readline on success", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Confirm?", false)).resolves.toBeUndefined();
    expect(mockClose).toHaveBeenCalled();
  });

  it("closes readline on error", async () => {
    mockQuestion.mockResolvedValueOnce("n");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Confirm?", false)).rejects.toThrow();
    expect(mockClose).toHaveBeenCalled();
  });

  it("calls question with correct prompt format", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(confirmOrThrow("Test?", false)).resolves.toBeUndefined();
    expect(mockQuestion).toHaveBeenCalledWith("Test? [y/N] ");
  });

  it("handles message with newlines", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(
      confirmOrThrow("Line 1\nLine 2\nLine 3", false)
    ).resolves.toBeUndefined();
  });

  it("handles message with tabs and spaces", async () => {
    mockQuestion.mockResolvedValueOnce("y");

    (mockStdin as any).isTTY = true;
    (mockStdout as any).isTTY = true;

    const { confirmOrThrow } = await import("../../../app/headless");

    await expect(
      confirmOrThrow("\tIndented\t\n  More spaces  ", false)
    ).resolves.toBeUndefined();
  });
});

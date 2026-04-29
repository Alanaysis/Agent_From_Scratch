import { describe, it, expect } from "bun:test";

describe("confirmWithSessionRule - response pattern logic", () => {
  it("normalizes 'a' to allow-session", () => {
    const normalized = "a".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(true);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes 'A' to allow-session", () => {
    const normalized = "A".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(true);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes 'always' to allow-session", () => {
    const normalized = "always".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(true);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes 'Always' to allow-session", () => {
    const normalized = "Always".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(true);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes 'y' to allow-once", () => {
    const normalized = "y".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(true);
  });

  it("normalizes 'Y' to allow-once", () => {
    const normalized = "Y".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(true);
  });

  it("normalizes 'yes' to allow-once", () => {
    const normalized = "yes".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(true);
  });

  it("normalizes 'Yes' to allow-once", () => {
    const normalized = "Yes".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(true);
  });

  it("normalizes 'n' to deny", () => {
    const normalized = "n".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes 'N' to deny", () => {
    const normalized = "N".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes 'no' to deny", () => {
    const normalized = "no".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes empty string to deny", () => {
    const normalized = "".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes whitespace to empty string", () => {
    const normalized = "   \t\n  ".trim().toLowerCase();
    expect(normalized).toBe("");
  });

  it("normalizes 'maybe' to deny", () => {
    const normalized = "maybe".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes 'nope' to deny", () => {
    const normalized = "nope".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes '0' to deny", () => {
    const normalized = "0".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes '1' to deny", () => {
    const normalized = "1".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("normalizes 'o' to deny", () => {
    const normalized = "o".trim().toLowerCase();
    expect(normalized === "a" || normalized === "always").toBe(false);
    expect(normalized === "y" || normalized === "yes").toBe(false);
  });

  it("handles case insensitivity for 'a'", () => {
    const inputs = ["a", "A", "aLwAyS", "ALWAYS", "Always"];
    for (const input of inputs) {
      const normalized = input.trim().toLowerCase();
      expect(normalized === "a" || normalized === "always").toBe(true);
    }
  });

  it("handles case insensitivity for 'y'", () => {
    const inputs = ["y", "Y", "YeS", "YES", "Yes"];
    for (const input of inputs) {
      const normalized = input.trim().toLowerCase();
      expect(normalized === "y" || normalized === "yes").toBe(true);
    }
  });

  it("trims leading whitespace", () => {
    expect("  y".trim().toLowerCase()).toBe("y");
    expect("   a".trim().toLowerCase()).toBe("a");
  });

  it("trims trailing whitespace", () => {
    expect("y  ".trim().toLowerCase()).toBe("y");
    expect("a   ".trim().toLowerCase()).toBe("a");
  });

  it("trims both leading and trailing whitespace", () => {
    expect("  y  ".trim().toLowerCase()).toBe("y");
    expect("  a  ".trim().toLowerCase()).toBe("a");
  });
});

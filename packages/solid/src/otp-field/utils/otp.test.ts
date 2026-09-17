import { describe, expect, it } from "vitest";

import { normalizeOTPValue, normalizeOTPValueWithDetails, removeOTPCharacter, replaceOTPValue, stripOTPWhitespace } from "./otp";

describe("normalizeOTPValue", () => {
  it("strips whitespace and rejects non-numeric characters by default", () => {
    expect(normalizeOTPValue("1 2a3", 6, "numeric")).toBe("123");
  });

  it("clamps the value to the slot count", () => {
    expect(normalizeOTPValue("1234567", 6, "numeric")).toBe("123456");
  });

  it("accepts letters for the alphanumeric validation type", () => {
    expect(normalizeOTPValue("a7C9XZ", 6, "alphanumeric")).toBe("a7C9XZ");
  });

  it("applies custom normalization and reports rejected characters", () => {
    const [value, didReject] = normalizeOTPValueWithDetails("ab12", 6, "alphanumeric", (next) => next.toUpperCase());
    expect(value).toBe("AB12");
    expect(didReject).toBe(false);

    const [, rejected] = normalizeOTPValueWithDetails("12a34b56c7", 6, "numeric");
    expect(rejected).toBe(true);
  });
});

describe("stripOTPWhitespace", () => {
  it("removes all whitespace", () => {
    expect(stripOTPWhitespace("1 2\t3\n4")).toBe("1234");
    expect(stripOTPWhitespace(null)).toBe("");
  });
});

describe("replaceOTPValue", () => {
  it("replaces characters at the slot index and stays length-bounded", () => {
    expect(replaceOTPValue("123", 1, "9", 6, "numeric")).toBe("193");
    expect(replaceOTPValue("123456", 4, "789", 6, "numeric")).toBe("123478");
  });
});

describe("removeOTPCharacter", () => {
  it("removes the character at the index", () => {
    expect(removeOTPCharacter("123", 1)).toBe("13");
  });

  it("returns the value unchanged for out-of-range indexes", () => {
    expect(removeOTPCharacter("123", 5)).toBe("123");
    expect(removeOTPCharacter("123", -1)).toBe("123");
  });
});

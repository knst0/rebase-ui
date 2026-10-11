import { describe, expect, it } from "vite-plus/test";

import { toStateAttributeValue } from "./stateToAttributes";

describe("toStateAttributeValue", () => {
  it("coerces values the way the DOM expects", () => {
    expect(toStateAttributeValue(true)).toBe("");
    expect(toStateAttributeValue("value")).toBe("value");
    expect(toStateAttributeValue(3)).toBe("3");
    expect(toStateAttributeValue(0)).toBe("0");
    expect(toStateAttributeValue(10n)).toBe("10");

    for (const omitted of [false, null, undefined, "", {}, []]) {
      expect(toStateAttributeValue(omitted)).toBeUndefined();
    }
  });
});

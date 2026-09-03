import { describe, expect, it } from "vitest";

import { isJSDOM, nextFrames, withRealAnimations } from "#test-utils";

const supportsInterpolateSize = () => typeof CSS !== "undefined" && CSS.supports("interpolate-size: allow-keywords");

describe.skipIf(isJSDOM)("interpolate-size", () => {
  it.skipIf(!supportsInterpolateSize())("animates height between 0 and auto without measurement", async () => {
    await withRealAnimations(async () => {
      const style = document.createElement("style");
      style.textContent = `
        .interpolate-probe {
          interpolate-size: allow-keywords;
          overflow: hidden;
          height: 0;
          transition: height 50ms linear;
        }
        .interpolate-probe[data-open] { height: auto; }
      `;
      document.head.append(style);

      const element = document.createElement("div");
      element.className = "interpolate-probe";
      element.innerHTML = "<p style='margin:0;height:120px'>content</p>";
      document.body.append(element);

      try {
        await nextFrames();
        element.setAttribute("data-open", "");
        await nextFrames();

        const animations = element.getAnimations();
        expect(animations.length).toBeGreaterThan(0);

        await Promise.all(animations.map((animation) => animation.finished));

        expect(element.getBoundingClientRect().height).toBe(120);
      } finally {
        element.remove();
        style.remove();
      }
    });
  });

  it("reports support consistently through CSS.supports", () => {
    expect(typeof supportsInterpolateSize()).toBe("boolean");
  });
});

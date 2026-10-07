import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Combobox from "../index.parts";
import { ComboboxArrow } from "./ComboboxArrow";

function renderOpenArrow() {
  const anchor = document.createElement("div");
  anchor.textContent = "anchor";
  document.body.appendChild(anchor);
  const cleanup = () => {
    anchor.remove();
  };
  render(() => (
    <Combobox.Root defaultOpen>
      <Combobox.Portal>
        <Combobox.Positioner anchor={anchor}>
          <ComboboxArrow data-testid="arrow" />
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  ));
  return cleanup;
}

describe("<Combobox.Arrow />", () => {
  it("renders a hidden arrow reporting the positioner side", async () => {
    const cleanup = renderOpenArrow();
    try {
      flush();
      await nextFrames();
      await nextFrames();

      const arrow = screen.getByTestId("arrow");
      expect(arrow).toHaveAttribute("aria-hidden", "true");
      expect(arrow).toHaveAttribute("data-open");
      expect(arrow.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
    } finally {
      cleanup();
    }
  });
});

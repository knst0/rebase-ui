import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";

import * as Combobox from "../index.parts";
import { ComboboxArrow } from "./ComboboxArrow";

afterEach(cleanup);

function renderOpenArrow() {
  const anchor = document.createElement("div");
  anchor.textContent = "anchor";
  document.body.appendChild(anchor);
  const cleanup = () => {
    anchor.remove();
  };
  mount(() => (
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
      tick();
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

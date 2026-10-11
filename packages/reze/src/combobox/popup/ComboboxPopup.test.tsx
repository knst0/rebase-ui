import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";

import * as Combobox from "../index.parts";
import { ComboboxPopup } from "./ComboboxPopup";

afterEach(cleanup);

function renderOpenPopup() {
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
          <ComboboxPopup data-testid="popup">Content</ComboboxPopup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  ));
  return cleanup;
}

describe("<Combobox.Popup />", () => {
  it("renders a presentation container with open state when open", async () => {
    const cleanup = renderOpenPopup();
    try {
      tick();
      await nextFrames();
      await nextFrames();

      const popup = screen.getByTestId("popup");
      expect(popup).toHaveTextContent("Content");
      expect(popup).toHaveAttribute("role", "presentation");
      expect(popup).toHaveAttribute("data-open");
      expect(popup.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
    } finally {
      cleanup();
    }
  });

  it("matches the positioner side", async () => {
    const anchor = document.createElement("div");
    anchor.textContent = "anchor";
    document.body.appendChild(anchor);
    try {
      mount(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Portal>
            <Combobox.Positioner data-testid="positioner" anchor={anchor}>
              <ComboboxPopup data-testid="popup">Content</ComboboxPopup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
      tick();
      await nextFrames();
      await nextFrames();

      expect(screen.getByTestId("popup").getAttribute("data-side")).toBe(screen.getByTestId("positioner").getAttribute("data-side"));
    } finally {
      anchor.remove();
    }
  });

  it("renders nothing when the combobox is closed", () => {
    mount(() => (
      <Combobox.Root>
        <Combobox.Portal>
          <Combobox.Positioner>
            <ComboboxPopup data-testid="popup">Content</ComboboxPopup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    tick();

    expect(screen.queryByTestId("popup")).toBeNull();
  });
});

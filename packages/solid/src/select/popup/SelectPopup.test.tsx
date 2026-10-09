import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Select from "../index.parts";
import { SelectPortal } from "../portal/SelectPortal";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { SelectPopup } from "./SelectPopup";
import { clearStyles, LIST_FUNCTIONAL_STYLES } from "./utils";

function renderOpenPopup() {
  return render(() => (
    <Select.Root defaultOpen>
      <SelectPortal>
        <SelectPositioner alignItemWithTrigger={false}>
          <SelectPopup data-testid="popup">Content</SelectPopup>
        </SelectPositioner>
      </SelectPortal>
    </Select.Root>
  ));
}

describe("<Select.Popup />", () => {
  it("renders a listbox labelled by the generated id when open", async () => {
    renderOpenPopup();
    flush();
    await nextFrames();
    await nextFrames();

    const popup = screen.getByTestId("popup");
    expect(popup).toHaveAttribute("role", "listbox");
    expect(popup.id).toMatch(/-list$/);
    expect(popup).toHaveAttribute("data-open");
    expect(popup.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
  });

  it("does not render aria-orientation when the popup owns the listbox role", async () => {
    renderOpenPopup();
    flush();
    await nextFrames();
    await nextFrames();

    // `listbox` is implicitly vertical.
    const popup = screen.getByTestId("popup");
    expect(popup).toHaveAttribute("role", "listbox");
    expect(popup).not.toHaveAttribute("aria-orientation");
  });

  it("matches the positioner side", async () => {
    render(() => (
      <Select.Root defaultOpen>
        <SelectPortal>
          <SelectPositioner data-testid="positioner" alignItemWithTrigger={false}>
            <SelectPopup data-testid="popup">Content</SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("popup").getAttribute("data-side")).toBe(screen.getByTestId("positioner").getAttribute("data-side"));
  });

  it("renders nothing when the select is closed", () => {
    render(() => (
      <Select.Root>
        <SelectPortal>
          <SelectPositioner>
            <SelectPopup data-testid="popup">Content</SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select.Root>
    ));
    flush();

    expect(screen.queryByTestId("popup")).toBeNull();
  });
});

describe("popup utils", () => {
  it("exposes relative list styles with kebab-case keys", () => {
    expect(LIST_FUNCTIONAL_STYLES.position).toBe("relative");
    expect(LIST_FUNCTIONAL_STYLES["max-height"]).toBe("100%");
  });

  it("clearStyles restores captured inline styles", () => {
    const element = document.createElement("div");
    element.style.top = "10px";
    clearStyles(element, { top: "5px", left: "" });
    expect(element.style.getPropertyValue("top")).toBe("5px");
    expect(element.style.getPropertyValue("left")).toBe("");
  });
});

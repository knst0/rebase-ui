import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Combobox from "../index.parts";
import { ComboboxPositioner } from "./ComboboxPositioner";

function renderOpenPositioner(positionerProps: Record<string, unknown> = {}) {
  const anchor = document.createElement("div");
  anchor.textContent = "anchor";
  document.body.appendChild(anchor);
  const cleanup = () => {
    anchor.remove();
  };
  render(() => (
    <Combobox.Root defaultOpen>
      <Combobox.Portal>
        <ComboboxPositioner data-testid="positioner" anchor={anchor} {...positionerProps}>
          <div>Content</div>
        </ComboboxPositioner>
      </Combobox.Portal>
    </Combobox.Root>
  ));
  return cleanup;
}

describe("<Combobox.Positioner />", () => {
  it("positions the popup with kebab-case styles and reports side", async () => {
    const cleanup = renderOpenPositioner();
    try {
      flush();
      await nextFrames();
      await nextFrames();

      const positioner = screen.getByTestId("positioner");
      expect(positioner.style.getPropertyValue("position")).toBe("absolute");
      expect(positioner.style.getPropertyValue("top")).toMatch(/px$/);
      expect(positioner.style.getPropertyValue("left")).toMatch(/px$/);
      expect(positioner.style.getPropertyValue("--available-height")).not.toBe("");
      expect(positioner.style.getPropertyValue("--anchor-width")).not.toBe("");
      expect(positioner.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
      expect(positioner).toHaveAttribute("data-open");
    } finally {
      cleanup();
    }
  });

  it("applies sideOffset to the floating position", async () => {
    const cleanup = renderOpenPositioner({ sideOffset: 12 });
    try {
      flush();
      await nextFrames();
      await nextFrames();

      const positioner = screen.getByTestId("positioner");
      expect(positioner.style.getPropertyValue("top")).toMatch(/px$/);
      expect(positioner).toHaveAttribute("data-open");
    } finally {
      cleanup();
    }
  });

  it("stays hidden until mounted", async () => {
    render(() => (
      <Combobox.Root>
        <ComboboxPositioner data-testid="positioner" />
      </Combobox.Root>
    ));
    flush();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner).toHaveAttribute("hidden");
    expect(positioner).toHaveAttribute("data-closed");
  });
  it("repositions a retained popup after a completed close", async () => {
    const [open, setOpen] = createSignal(true);
    const [actions, setActions] = createSignal<Combobox.Root.Actions | null>(null);
    render(() => (
      <Combobox.Root open={open()} actionsRef={setActions}>
        <Combobox.Input />
        <Combobox.Portal keepMounted>
          <ComboboxPositioner data-testid="positioner">
            <Combobox.Popup>Content</Combobox.Popup>
          </ComboboxPositioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();
    const positioner = screen.getByTestId("positioner");
    expect(positioner.style.position).toBe("absolute");
    flush(() => setOpen(false));
    flush(() => actions()!.unmount());
    await nextFrames();
    await nextFrames();
    expect(positioner).toHaveAttribute("hidden");
    flush(() => setOpen(true));
    await nextFrames();
    await nextFrames();
    expect(positioner).not.toHaveAttribute("hidden");
    expect(positioner.style.position).toBe("absolute");
    expect(positioner.style.opacity).not.toBe("0");
  });
});

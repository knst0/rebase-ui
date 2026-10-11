import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { store } from "reze-js";

import { nextFrames } from "../../../test/utils";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import * as Combobox from "../index.parts";
import { useComboboxRootContext } from "../root/ComboboxRootContext";
import type { ComboboxStore } from "../store/ComboboxStore";
import { ComboboxPositioner } from "./ComboboxPositioner";

afterEach(cleanup);

function CaptureStore(props: { onStore: (store: ComboboxStore) => void }) {
  props.onStore(useComboboxRootContext());
  return null;
}

function renderOpenPositioner(positionerProps: Record<string, unknown> = {}) {
  const anchor = document.createElement("div");
  anchor.textContent = "anchor";
  document.body.appendChild(anchor);
  const cleanup = () => {
    anchor.remove();
  };
  mount(() => (
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
      tick();
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
      tick();
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
    mount(() => (
      <Combobox.Root>
        <ComboboxPositioner data-testid="positioner" />
      </Combobox.Root>
    ));
    tick();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner).toHaveAttribute("hidden");
    expect(positioner).toHaveAttribute("data-closed");
  });
  it("repositions a retained popup after a completed close", async () => {
    const state = store({ open: true, actions: null as Combobox.Root.Actions | null });
    let captured: ComboboxStore | undefined;
    mount(() => (
      <Combobox.Root
        open={state.open}
        actionsRef={(next) => {
          state.actions = next;
        }}
        onOpenChange={(nextOpen, eventDetails) => {
          if (!nextOpen) {
            eventDetails.preventUnmountOnClose();
          }
          if (!eventDetails.isCanceled) {
            state.open = nextOpen;
          }
        }}
      >
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
        <Combobox.Input />
        <Combobox.Portal keepMounted>
          <ComboboxPositioner data-testid="positioner">
            <Combobox.Popup>Content</Combobox.Popup>
          </ComboboxPositioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    tick();
    await nextFrames();
    await nextFrames();
    const positioner = screen.getByTestId("positioner");
    expect(positioner.style.position).toBe("absolute");
    captured?.context.setOpen(false, createChangeEventDetails(REASONS.escapeKey));
    tick();
    await nextFrames();
    await nextFrames();
    // The close opted out of the automatic unmount, so the manual action completes closing.
    expect(captured?.peek("mounted")).toBe(true);
    state.actions!.unmount();
    tick();
    await nextFrames();
    await nextFrames();
    expect(positioner).toHaveAttribute("hidden");
    state.open = true;
    tick();
    await nextFrames();
    await nextFrames();
    expect(positioner).not.toHaveAttribute("hidden");
    expect(positioner.style.position).toBe("absolute");
    expect(positioner.style.opacity).not.toBe("0");
  });
});

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Select from "../index.parts";
import { SelectPortal } from "../portal/SelectPortal";
import { SelectPopup } from "../popup/SelectPopup";
import { useSelectRootContext } from "../root/SelectRootContext";
import { SelectPositioner } from "./SelectPositioner";

function TriggerAnchor() {
  const store = useSelectRootContext();
  return (
    <button
      ref={(element) => {
        store.set("triggerElement", element);
      }}
    >
      Trigger
    </button>
  );
}

function renderOpenPositioner(positionerProps: Record<string, any> = {}) {
  return render(() => (
    <Select.Root defaultOpen>
      <TriggerAnchor />
      <SelectPortal>
        <SelectPositioner data-testid="positioner" alignItemWithTrigger={false} {...positionerProps}>
          <SelectPopup>Content</SelectPopup>
        </SelectPositioner>
      </SelectPortal>
    </Select.Root>
  ));
}

describe("<Select.Positioner />", () => {
  it("positions the popup with kebab-case styles and reports side", async () => {
    renderOpenPositioner();
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
  });
  it("applies sideOffset to the floating position", async () => {
    renderOpenPositioner({ sideOffset: 12 });
    flush();
    await nextFrames();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner.style.getPropertyValue("top")).toMatch(/px$/);
    expect(positioner).toHaveAttribute("data-open");
  });

  it("repositions a retained popup after a completed close", async () => {
    const [open, setOpen] = createSignal(true);
    render(() => (
      <Select.Root open={open()}>
        <TriggerAnchor />
        <SelectPositioner data-testid="positioner" alignItemWithTrigger={false}>
          <SelectPopup>Content</SelectPopup>
        </SelectPositioner>
      </Select.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();
    const positioner = screen.getByTestId("positioner");
    expect(positioner.style.position).toBe("absolute");
    flush(() => setOpen(false));
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

  it("stays hidden until mounted", async () => {
    render(() => (
      <Select.Root>
        <SelectPositioner data-testid="positioner" />
      </Select.Root>
    ));
    flush();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner).toHaveAttribute("hidden");
    expect(positioner).toHaveAttribute("data-closed");
  });

  it("reports side=none while aligned with the trigger", async () => {
    render(() => (
      <Select.Root defaultOpen>
        <SelectPortal>
          <SelectPositioner data-testid="positioner">
            <SelectPopup>Content</SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toHaveAttribute("data-side", "none");
  });
});

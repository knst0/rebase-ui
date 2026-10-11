import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Select from "../index.parts";
import { SelectPopup } from "../popup/SelectPopup";
import { SelectPortal } from "../portal/SelectPortal";
import { useSelectRootContext } from "../root/SelectRootContext";
import { SelectPositioner } from "./SelectPositioner";

afterEach(cleanup);

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
  return mount(() => (
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
  });
  it("applies sideOffset to the floating position", async () => {
    renderOpenPositioner({ sideOffset: 12 });
    tick();
    await nextFrames();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner.style.getPropertyValue("top")).toMatch(/px$/);
    expect(positioner).toHaveAttribute("data-open");
  });

  it("repositions a retained popup after a completed close", async () => {
    let setOpen!: (value: boolean) => void;
    function Test() {
      let open = signal(true);
      setOpen = (next: boolean) => {
        open = next;
      };
      return (
        <Select.Root open={open}>
          <TriggerAnchor />
          <SelectPositioner data-testid="positioner" alignItemWithTrigger={false}>
            <SelectPopup>Content</SelectPopup>
          </SelectPositioner>
        </Select.Root>
      );
    }
    mount(() => <Test />);
    tick();
    await nextFrames();
    await nextFrames();
    const positioner = screen.getByTestId("positioner");
    expect(positioner.style.position).toBe("absolute");
    setOpen(false);
    tick();
    await nextFrames();
    await nextFrames();
    expect(positioner).toHaveAttribute("hidden");
    setOpen(true);
    tick();
    await nextFrames();
    await nextFrames();
    expect(positioner).not.toHaveAttribute("hidden");
    expect(positioner.style.position).toBe("absolute");
    expect(positioner.style.opacity).not.toBe("0");
  });

  it("stays hidden until mounted", async () => {
    mount(() => (
      <Select.Root>
        <SelectPositioner data-testid="positioner" />
      </Select.Root>
    ));
    tick();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner).toHaveAttribute("hidden");
    expect(positioner).toHaveAttribute("data-closed");
  });

  it("reports side=none while aligned with the trigger", async () => {
    mount(() => (
      <Select.Root defaultOpen>
        <SelectPortal>
          <SelectPositioner data-testid="positioner">
            <SelectPopup>Content</SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select.Root>
    ));
    tick();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toHaveAttribute("data-side", "none");
  });
});

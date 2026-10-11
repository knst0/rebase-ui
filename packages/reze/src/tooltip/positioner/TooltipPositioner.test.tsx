import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { fireEvent, screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Tooltip from "../index.parts";

afterEach(cleanup);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("<Tooltip.Positioner />", () => {
  it("positions the popup with kebab-case styles and reports side", async () => {
    mount(() => (
      <Tooltip.Root>
        <Tooltip.Trigger delay={0}>Hover me</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner data-testid="positioner">
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    tick();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover me" }));
    await sleep(10);
    tick();
    await nextFrames();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner.style.getPropertyValue("position")).toBe("absolute");
    expect(positioner.style.getPropertyValue("top")).toMatch(/px$/);
    expect(positioner.style.getPropertyValue("left")).toMatch(/px$/);
    expect(positioner.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
    expect(positioner).toHaveAttribute("data-open");
  });

  it("stays hidden until mounted", async () => {
    mount(() => (
      <Tooltip.Root>
        <Tooltip.Portal keepMounted>
          <Tooltip.Positioner data-testid="positioner">
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    tick();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toHaveAttribute("hidden");
  });

  it("repositions a retained popup after closing and reopening", async () => {
    let setOpen!: (value: boolean) => void;
    function Test() {
      let open = signal(true);
      setOpen = (value: boolean) => {
        open = value;
      };
      return (
        <Tooltip.Root
          open={open}
          onOpenChange={(next) => {
            open = next;
          }}
        >
          <Tooltip.Trigger>Hover me</Tooltip.Trigger>
          <Tooltip.Portal keepMounted>
            <Tooltip.Positioner data-testid="positioner">
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }
    mount(() => <Test />);
    tick();
    await nextFrames();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner).toBeVisible();
    expect(positioner.style.opacity).not.toBe("0");

    setOpen(false);
    tick();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toBe(positioner);
    expect(positioner).toHaveAttribute("hidden");

    setOpen(true);
    tick();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toBe(positioner);
    expect(positioner).not.toHaveAttribute("hidden");
    expect(positioner).toHaveAttribute("data-open");
    expect(positioner).toBeVisible();
    expect(positioner.style.opacity).not.toBe("0");
    expect(positioner.style.getPropertyValue("position")).toBe("absolute");
    expect(positioner.style.getPropertyValue("top")).toMatch(/px$/);
    expect(positioner.style.getPropertyValue("left")).toMatch(/px$/);
  });
});

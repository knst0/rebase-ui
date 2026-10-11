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

function renderTrigger(options?: { triggerProps?: Record<string, any>; rootProps?: Record<string, any> }) {
  const { triggerProps = {}, rootProps = {} } = options ?? {};
  mount(() => (
    <Tooltip.Root {...rootProps}>
      <Tooltip.Trigger delay={0} {...triggerProps}>
        Hover me
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>Tooltip content</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  ));
  tick();

  return screen.getByRole("button", { name: "Hover me" });
}

describe("<Tooltip.Trigger />", () => {
  it("marks itself open while its tooltip is open", async () => {
    const trigger = renderTrigger();

    expect(trigger).not.toHaveAttribute("data-popup-open");

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    tick();

    expect(trigger).toHaveAttribute("data-popup-open");
  });

  it("marks itself disabled and does not open when disabled", async () => {
    const trigger = renderTrigger({ triggerProps: { disabled: true } });

    expect(trigger).toHaveAttribute("data-trigger-disabled");

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    tick();

    expect(trigger).not.toHaveAttribute("data-popup-open");
    expect(screen.queryByText("Tooltip content")).toBeNull();
  });

  it("updates interactions when disabled toggles at runtime", async () => {
    let setDisabled!: (value: boolean) => void;
    function Test() {
      let disabled = signal(false);
      setDisabled = (value: boolean) => {
        disabled = value;
      };
      return (
        <Tooltip.Root>
          <Tooltip.Trigger delay={0} disabled={disabled}>
            Hover me
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Tooltip content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }
    mount(() => <Test />);
    tick();
    const trigger = screen.getByRole("button", { name: "Hover me" });

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    tick();
    expect(trigger).toHaveAttribute("data-popup-open");

    fireEvent.mouseLeave(trigger);
    await sleep(10);
    tick();
    expect(trigger).not.toHaveAttribute("data-popup-open");

    setDisabled(true);
    tick();
    expect(trigger).toHaveAttribute("data-trigger-disabled");

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    tick();
    expect(trigger).not.toHaveAttribute("data-popup-open");
    expect(screen.queryByText("Tooltip content")).toBeNull();

    setDisabled(false);
    tick();
    expect(trigger).not.toHaveAttribute("data-trigger-disabled");

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    tick();
    expect(trigger).toHaveAttribute("data-popup-open");
  });

  it("cancels a pending hover open when clicked before the delay", async () => {
    const trigger = renderTrigger({ triggerProps: { delay: 40 } });

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger);
    tick();
    fireEvent.click(trigger);
    await sleep(80);
    tick();
    await nextFrames();

    expect(screen.queryByText("Tooltip content")).toBeNull();
  });

  it("throws a descriptive error outside a root and without a handle", () => {
    expect(() => mount(() => <Tooltip.Trigger delay={0}>Hover me</Tooltip.Trigger>)).toThrow(
      "Rebase UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.",
    );
  });
});

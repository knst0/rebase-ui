import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as NumberField from "../index.parts";

afterEach(cleanup);

function renderScrubArea(onClick: () => void) {
  const { el } = mount(() => (
    <NumberField.Root defaultValue={0}>
      <NumberField.ScrubArea data-testid="scrub-area" onClick={onClick}>
        <NumberField.ScrubAreaCursor />
      </NumberField.ScrubArea>
      <NumberField.Input data-testid="input" />
    </NumberField.Root>
  ));
  tick();
  const scrubArea = el.querySelector('[data-testid="scrub-area"]') as HTMLElement;
  if (!scrubArea) {
    throw new Error("scrub area not found");
  }
  return scrubArea;
}

function pointerEvent(type: string, init: Record<string, unknown> = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, init);
  return event;
}

async function pressAndRelease(scrubArea: HTMLElement) {
  scrubArea.dispatchEvent(pointerEvent("pointerdown", { button: 0, pointerType: "mouse", clientX: 10, clientY: 10 }));
  tick();
  // The pointerdown handler awaits the pointer-lock request before settling.
  await Promise.resolve();
  await Promise.resolve();
  tick();
  window.dispatchEvent(new Event("pointerup", { bubbles: true }));
  tick();
}

describe("<NumberField.ScrubArea />", () => {
  it("synthesizes a click when no native click arrives after pointerup", async () => {
    const handleClick = vi.fn();
    const scrubArea = renderScrubArea(handleClick);

    await pressAndRelease(scrubArea);

    // The synthesized click is deferred by one task.
    expect(handleClick).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 10));
    tick();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("fires onClick once when the native click arrives after pointerup", async () => {
    const handleClick = vi.fn();
    const scrubArea = renderScrubArea(handleClick);

    await pressAndRelease(scrubArea);

    // Without pointer lock the browser dispatches its own click after pointerup
    // in the same task; the deferred synthesis must stand down.
    scrubArea.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    tick();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render, screen } from "@solidjs/testing-library";
import "@testing-library/jest-dom/vitest";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { NumberField } from "../index";

function renderScrubArea(onClick: () => void) {
  render(() => (
    <NumberField.Root defaultValue={0}>
      <NumberField.ScrubArea data-testid="scrub-area" onClick={onClick}>
        <NumberField.ScrubAreaCursor />
      </NumberField.ScrubArea>
      <NumberField.Input data-testid="input" />
    </NumberField.Root>
  ));
  flush();
  return screen.getByTestId("scrub-area") as HTMLElement;
}

async function pressAndRelease(scrubArea: HTMLElement) {
  fireEvent.pointerDown(scrubArea, { button: 0, pointerType: "mouse", clientX: 10, clientY: 10 });
  flush();
  // The pointerdown handler awaits the pointer-lock request before settling.
  await Promise.resolve();
  await Promise.resolve();
  flush();
  window.dispatchEvent(new Event("pointerup", { bubbles: true }));
  flush();
}

describe("<NumberField.ScrubArea />", () => {
  it("synthesizes a click when no native click arrives after pointerup", async () => {
    const handleClick = vi.fn();
    const scrubArea = renderScrubArea(handleClick);

    await pressAndRelease(scrubArea);

    // The synthesized click is deferred by one task.
    expect(handleClick).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 10));
    flush();

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
    flush();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

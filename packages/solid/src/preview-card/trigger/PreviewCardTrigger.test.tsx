import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import * as PreviewCard from "../index.parts";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function renderTrigger(options?: { triggerProps?: Record<string, any>; rootProps?: Record<string, any> }) {
  const { triggerProps = {}, rootProps = {} } = options ?? {};
  render(() => (
    <PreviewCard.Root {...rootProps}>
      <PreviewCard.Trigger delay={0} closeDelay={0} href="https://example.com/typography" {...triggerProps}>
        typography
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner>
          <PreviewCard.Popup>Preview content</PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  ));

  return screen.getByRole("link", { name: "typography" });
}

describe("<PreviewCard.Trigger />", () => {
  it("renders a link and marks itself open while its card is open", async () => {
    const trigger = renderTrigger();

    expect(trigger.tagName).toBe("A");
    expect(trigger).not.toHaveAttribute("data-popup-open");

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();

    expect(trigger).toHaveAttribute("data-popup-open");
    expect(screen.getByText("Preview content")).toBeVisible();
  });

  it("opens on focus", async () => {
    const trigger = renderTrigger();

    trigger.focus();
    await sleep(10);
    flush();

    expect(trigger).toHaveAttribute("data-popup-open");
  });

  it("forwards its id to the rendered link", async () => {
    const trigger = renderTrigger({ triggerProps: { id: "my-trigger" } });

    expect(trigger).toHaveAttribute("id", "my-trigger");
  });

  it("throws when rendered outside a root without a handle", () => {
    expect(() => render(() => <PreviewCard.Trigger href="https://example.com">orphan</PreviewCard.Trigger>)).toThrow(
      "Rebase UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.",
    );
  });
});

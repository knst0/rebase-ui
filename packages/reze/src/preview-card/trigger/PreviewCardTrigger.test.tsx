import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as PreviewCard from "../index.parts";

afterEach(cleanup);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function dispatchMouseEnter(target: Element) {
  target.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
}

function renderTrigger(options?: { triggerProps?: Record<string, any>; rootProps?: Record<string, any> }) {
  const { triggerProps = {}, rootProps = {} } = options ?? {};
  mount(() => (
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
  tick();

  return screen.getByRole("link", { name: "typography" });
}

describe("<PreviewCard.Trigger />", () => {
  it("renders a link and marks itself open while its card is open", async () => {
    const trigger = renderTrigger();

    expect(trigger.tagName).toBe("A");
    expect(trigger).not.toHaveAttribute("data-popup-open");

    dispatchMouseEnter(trigger);
    await sleep(10);
    tick();

    expect(trigger).toHaveAttribute("data-popup-open");
    expect(screen.getByText("Preview content")).toBeVisible();
  });

  it("opens on focus", async () => {
    const trigger = renderTrigger();

    (trigger as HTMLElement).focus();
    await sleep(10);
    tick();

    expect(trigger).toHaveAttribute("data-popup-open");
  });

  it("forwards its id to the rendered link", async () => {
    const trigger = renderTrigger({ triggerProps: { id: "my-trigger" } });

    expect(trigger).toHaveAttribute("id", "my-trigger");
  });

  it("throws when rendered outside a root without a handle", () => {
    expect(() => mount(() => <PreviewCard.Trigger href="https://example.com">orphan</PreviewCard.Trigger>)).toThrow(
      "Rebase UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.",
    );
  });
});

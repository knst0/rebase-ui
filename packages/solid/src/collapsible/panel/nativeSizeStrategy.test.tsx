import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { afterEach, describe, expect, it } from "vitest";

import { isJSDOM, nextFrames, withRealAnimations } from "#test-utils";

import * as Collapsible from "../index.parts";
import * as CollapsiblePanelCssVars from "./CollapsiblePanelCssVars";
import * as CollapsiblePanelDataAttributes from "./CollapsiblePanelDataAttributes";
import { supportsInterpolateSize } from "./panelStrategy";

const unsupported = isJSDOM || !supportsInterpolateSize();

async function waitForAnimations(element: HTMLElement) {
  for (let i = 0; i < 30; i += 1) {
    const animations = element.getAnimations();
    if (animations.length > 0) {
      return animations;
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return [];
}

describe.skipIf(unsupported)("native sizing strategy", () => {
  afterEach(() => {
    globalThis.REBASE_UI_EXPERIMENTAL_NATIVE_SIZING = undefined;
  });

  it("publishes no measurement custom properties", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel sizing="native">Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    await user.click(screen.getByRole("button"));
    flush();
    await nextFrames();

    const panel = screen.getByText("Content");

    expect(panel.style.getPropertyValue(CollapsiblePanelCssVars.collapsiblePanelHeight)).toBe("");
    expect(panel.style.getPropertyValue(CollapsiblePanelCssVars.collapsiblePanelWidth)).toBe("");
    expect(panel.style.getPropertyValue("interpolate-size")).toBe("allow-keywords");
  });

  it("opens and closes, unmounting after the animation finishes", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel sizing="native">Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    expect(screen.queryByText("Content")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button"));
    flush();
    await nextFrames();

    const panel = screen.getByText("Content");
    expect(panel).toBeVisible();
    expect(panel).toHaveAttribute(CollapsiblePanelDataAttributes.open, "");

    await user.click(screen.getByRole("button"));
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("animates height to auto using consumer CSS", async () => {
    await withRealAnimations(async () => {
      const style = document.createElement("style");
      style.textContent = `
        .native-panel { overflow: hidden; height: auto; transition: height 500ms linear; }
        .native-panel[data-starting-style], .native-panel[data-ending-style] { height: 0; }
        .native-panel[data-closed] { height: 0; }
      `;
      document.head.append(style);

      try {
        const user = userEvent.setup();
        render(() => (
          <Collapsible.Root>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel sizing="native" class="native-panel" keepMounted>
              <p style={{ margin: "0", height: "120px" }}>Content</p>
            </Collapsible.Panel>
          </Collapsible.Root>
        ));

        await nextFrames();
        const panel = screen.getByText("Content").parentElement!;

        await user.click(screen.getByRole("button"));
        flush();

        const animations = await waitForAnimations(panel);
        expect(animations.length).toBeGreaterThan(0);

        await Promise.all(animations.map((animation) => animation.finished));
        expect(panel.getBoundingClientRect().height).toBe(120);
      } finally {
        style.remove();
      }
    });
  });

  it("selects the native strategy automatically when the global flag is set", async () => {
    globalThis.REBASE_UI_EXPERIMENTAL_NATIVE_SIZING = true;

    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    await user.click(screen.getByRole("button"));
    flush();
    await nextFrames();

    const panel = screen.getByText("Content");
    expect(panel.style.getPropertyValue("interpolate-size")).toBe("allow-keywords");
    expect(panel.style.getPropertyValue(CollapsiblePanelCssVars.collapsiblePanelHeight)).toBe("");
  });

  it("keeps the measured contract when the global flag is unset", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    await user.click(screen.getByRole("button"));
    flush();
    await nextFrames();

    const panel = screen.getByText("Content");
    expect(panel.style.getPropertyValue(CollapsiblePanelCssVars.collapsiblePanelHeight)).not.toBe("");
    expect(panel.style.getPropertyValue("interpolate-size")).toBe("");
  });

  it('respects an explicit `sizing="measured"` override while the global flag is set', async () => {
    globalThis.REBASE_UI_EXPERIMENTAL_NATIVE_SIZING = true;

    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel sizing="measured">Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    await user.click(screen.getByRole("button"));
    flush();
    await nextFrames();

    const panel = screen.getByText("Content");
    expect(panel.style.getPropertyValue(CollapsiblePanelCssVars.collapsiblePanelHeight)).not.toBe("");
    expect(panel.style.getPropertyValue("interpolate-size")).toBe("");
  });
});

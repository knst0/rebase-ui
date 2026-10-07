import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import * as CollapsiblePanelDataAttributes from "../../collapsible/panel/CollapsiblePanelDataAttributes";
import * as Accordion from "../index.parts";

const PANEL_CONTENT = "Panel contents";

function renderPanel(rootProps: Accordion.Root.Props = {}, panelProps: Accordion.Panel.Props = {}) {
  render(() => (
    <Accordion.Root {...rootProps}>
      <Accordion.Item value="one">
        <Accordion.Header>
          <Accordion.Trigger>Trigger</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel data-testid="panel" {...panelProps}>
          {PANEL_CONTENT}
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ));

  return {
    trigger: screen.getByRole("button"),
    panel: () => screen.queryByTestId("panel"),
  };
}

describe("<Accordion.Panel />", () => {
  it("is not rendered while closed by default", () => {
    const { panel } = renderPanel();

    expect(panel()).toBe(null);
  });

  it("renders as a labelled region when open", async () => {
    const user = userEvent.setup();
    const { trigger, panel } = renderPanel();

    await user.click(trigger);
    flush();

    expect(panel()).toHaveAttribute("role", "region");
    expect(panel()).toHaveTextContent(PANEL_CONTENT);
  });

  it.each([
    ["set on the panel", {}, { keepMounted: true }],
    ["inherited from the root", { keepMounted: true }, {}],
  ])("stays mounted and hidden with `keepMounted` %s", (_name, rootProps, panelProps) => {
    const { panel } = renderPanel(rootProps, panelProps);

    expect(panel()).toHaveAttribute("hidden");
    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.closed, "");
  });

  it("uses `hidden=until-found` when `hiddenUntilFound` is set", () => {
    const { panel } = renderPanel({}, { hiddenUntilFound: true, keepMounted: true });

    expect(panel()).toHaveAttribute("hidden", "until-found");
  });

  it("applies the panel size custom properties", () => {
    const { panel } = renderPanel({ defaultValue: ["one"] });
    flush();

    const style = panel()!.getAttribute("style") ?? "";

    expect(style).toContain("--accordion-panel-height");
    expect(style).toContain("--accordion-panel-width");
  });

  it("honors a custom id", async () => {
    const user = userEvent.setup();
    const { trigger, panel } = renderPanel({}, { id: "custom-panel" });

    await user.click(trigger);
    flush();

    expect(panel()).toHaveAttribute("id", "custom-panel");
    expect(trigger).toHaveAttribute("aria-controls", "custom-panel");
  });
});

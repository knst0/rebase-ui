import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as Accordion from "../index.parts";
import * as AccordionItemDataAttributes from "./AccordionItemDataAttributes";

afterEach(cleanup);

function renderItems(rootProps: Accordion.Root.Props = {}) {
  mount(() => (
    <Accordion.Root {...rootProps}>
      <Accordion.Item value="one" data-testid="one">
        <Accordion.Header data-testid="header">
          <Accordion.Trigger>Trigger 1</Accordion.Trigger>
        </Accordion.Header>
      </Accordion.Item>
      <Accordion.Item value="two" data-testid="two">
        <Accordion.Header>
          <Accordion.Trigger>Trigger 2</Accordion.Trigger>
        </Accordion.Header>
      </Accordion.Item>
    </Accordion.Root>
  ));

  tick();
}

describe("<Accordion.Item />", () => {
  it("assigns document-order indexes to items", () => {
    renderItems();

    expect(screen.getByTestId("one")).toHaveAttribute(AccordionItemDataAttributes.index, "0");
    expect(screen.getByTestId("two")).toHaveAttribute(AccordionItemDataAttributes.index, "1");
  });

  it("falls back to the root disabled state", () => {
    renderItems({ disabled: true });

    expect(screen.getAllByRole("button")[0]).toBeDisabled();
  });

  it("reflects the open state on the item and its header", () => {
    renderItems({ defaultValue: ["one"] });

    expect(screen.getByTestId("one")).toHaveAttribute(AccordionItemDataAttributes.open, "");
    expect(screen.getByTestId("header")).toHaveAttribute(AccordionItemDataAttributes.open, "");
  });
});

describe("<Accordion.Header />", () => {
  it("renders an h3 by default", () => {
    renderItems();

    expect(screen.getByTestId("header").tagName).toBe("H3");
  });

  it("renders the customized element", () => {
    mount(() => (
      <Accordion.Root>
        <Accordion.Item value="one">
          <Accordion.Header as="div" data-testid="header">
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
    ));
    tick();

    expect(screen.getByTestId("header").tagName).toBe("DIV");
  });
});

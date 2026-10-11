import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as Accordion from "../index.parts";
import * as AccordionItemDataAttributes from "../item/AccordionItemDataAttributes";

afterEach(cleanup);

function renderHeader(props: Record<string, any> = {}) {
  return mount(() => (
    <Accordion.Root defaultValue={["one"]}>
      <Accordion.Item value="one">
        <Accordion.Header data-testid="header" {...props}>
          <Accordion.Trigger>Trigger</Accordion.Trigger>
        </Accordion.Header>
      </Accordion.Item>
    </Accordion.Root>
  ));
}

describe("<Accordion.Header />", () => {
  it("renders an h3 by default", () => {
    renderHeader();
    tick();

    expect(screen.getByTestId("header").tagName).toBe("H3");
  });

  it("renders the customized element", () => {
    renderHeader({ as: "div" });
    tick();

    expect(screen.getByTestId("header").tagName).toBe("DIV");
  });

  it("reflects the item open state", () => {
    renderHeader();
    tick();

    expect(screen.getByTestId("header")).toHaveAttribute(AccordionItemDataAttributes.open, "");
  });
});

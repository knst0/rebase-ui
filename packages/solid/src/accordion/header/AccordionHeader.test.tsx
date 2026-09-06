import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import * as Accordion from "../index.parts";
import * as AccordionItemDataAttributes from "../item/AccordionItemDataAttributes";

function renderHeader(props: Record<string, any> = {}) {
  return render(() => (
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

    expect(screen.getByTestId("header").tagName).toBe("H3");
  });

  it("renders the customized element", () => {
    renderHeader({ as: "div" });

    expect(screen.getByTestId("header").tagName).toBe("DIV");
  });

  it("reflects the item open state", () => {
    renderHeader();

    expect(screen.getByTestId("header")).toHaveAttribute(AccordionItemDataAttributes.open, "");
  });
});

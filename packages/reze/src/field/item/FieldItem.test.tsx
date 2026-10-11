import "@testing-library/jest-dom/vitest";
import { cleanup, mount } from "@rezejs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as Field from "../index.parts";

afterEach(cleanup);

function getByTestId(root: ParentNode, testId: string): HTMLElement {
  const found = root.querySelector(`[data-testid="${testId}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`element with data-testid="${testId}" not found`);
  }
  return found;
}

describe("<Field.Item />", () => {
  it("renders a div element", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Item data-testid="item" />
      </Field.Root>
    ));

    expect(getByTestId(el, "item").tagName).toBe("DIV");
  });

  it("renders the customized item element", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Item as="section" data-testid="item" />
      </Field.Root>
    ));

    expect(getByTestId(el, "item").tagName).toBe("SECTION");
  });

  it("attaches a callback ref to the item element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Field.Root>
        <Field.Item
          data-testid="item"
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        />
      </Field.Root>
    ));

    expect(instance).toBe(getByTestId(el, "item"));
    expect(instance).toBeInstanceOf(window.HTMLDivElement);
  });

  it("reflects disabled state on the item", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Item disabled data-testid="item" />
      </Field.Root>
    ));

    expect(getByTestId(el, "item")).toHaveAttribute("data-disabled");
  });

  it("does not mark enabled items as disabled", () => {
    const { el } = mount(() => (
      <Field.Root disabled>
        <Field.Item data-testid="item" />
      </Field.Root>
    ));

    expect(getByTestId(el, "item")).toHaveAttribute("data-disabled");
  });

  it("inherits the root's validity state attributes", () => {
    const { el } = mount(() => (
      <Field.Root invalid>
        <Field.Item data-testid="item" />
      </Field.Root>
    ));

    expect(getByTestId(el, "item")).toHaveAttribute("data-invalid", "");
  });
});

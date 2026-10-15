import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
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

describe("<Field.Description />", () => {
  it("renders a paragraph element", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Description data-testid="description">Message</Field.Description>
      </Field.Root>
    ));

    expect(getByTestId(el, "description").tagName).toBe("P");
  });

  it("renders the customized description element", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Description as="span" data-testid="description">
          Message
        </Field.Description>
      </Field.Root>
    ));

    expect(getByTestId(el, "description").tagName).toBe("SPAN");
  });

  it("attaches a callback ref to the description element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Field.Root>
        <Field.Description
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        >
          Message
        </Field.Description>
      </Field.Root>
    ));

    expect(instance).toBe(el.querySelector("p"));
    expect(instance).toBeInstanceOf(window.HTMLParagraphElement);
  });

  it("should set aria-describedby on the control automatically", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Control />
        <Field.Description>Message</Field.Description>
      </Field.Root>
    ));
    tick();

    const description = Array.from(el.querySelectorAll("p")).find((element) => element.textContent === "Message") as HTMLElement;
    expect(el.querySelector("input")).toHaveAttribute("aria-describedby", description.id);
  });

  it("should preserve user aria-describedby values on the control", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Control aria-describedby="external-description" />
        <Field.Description>Message</Field.Description>
      </Field.Root>
    ));
    tick();

    const description = Array.from(el.querySelectorAll("p")).find((element) => element.textContent === "Message") as HTMLElement;
    expect((el.querySelector("input") as HTMLInputElement).getAttribute("aria-describedby")).toBe(`external-description ${description.id}`);
  });

  it("reflects the disabled state from Field.Item", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Description data-testid="description">Message</Field.Description>
        </Field.Item>
      </Field.Root>
    ));

    expect(getByTestId(el, "description")).toHaveAttribute("data-disabled");
  });
});

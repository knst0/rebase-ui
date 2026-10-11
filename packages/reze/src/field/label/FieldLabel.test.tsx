import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { Portal } from "reze-js";
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

describe("<Field.Label />", () => {
  it("renders a native label element", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    expect(getByTestId(el, "label").tagName).toBe("LABEL");
  });

  it("renders the customized label element", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Label as="span" nativeLabel={false} data-testid="label">
          Label
        </Field.Label>
      </Field.Root>
    ));

    expect(getByTestId(el, "label").tagName).toBe("SPAN");
  });

  it("attaches a callback ref to the label element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Field.Root>
        <Field.Label
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        >
          Label
        </Field.Label>
      </Field.Root>
    ));

    expect(instance).toBe(el.querySelector("label"));
    expect(instance).toBeInstanceOf(window.HTMLLabelElement);
  });

  it("should set htmlFor referencing the control automatically", () => {
    const { el } = mount(() => (
      <Field.Root data-testid="field">
        <Field.Control />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    expect(getByTestId(el, "label")).toHaveAttribute("for", (el.querySelector("input") as HTMLInputElement).id);
  });

  it("when nativeLabel={false}, clicking focuses the associated control", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
        <Field.Label nativeLabel={false} as="div" data-testid="label">
          Label
        </Field.Label>
      </Field.Root>
    ));

    const label = getByTestId(el, "label");
    const control = getByTestId(el, "control");

    expect(label).not.toHaveAttribute("for");

    fire(label, "click");
    tick();
    expect(control).toHaveFocus();
  });

  it("reflects the disabled state from Field.Item", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Item>
      </Field.Root>
    ));

    expect(getByTestId(el, "label")).toHaveAttribute("data-disabled");
  });

  it("focuses the control in its shadow root when the outer document has a matching ID", () => {
    const host = document.createElement("div");
    const shadowRoot = host.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    shadowRoot.appendChild(container);
    document.body.appendChild(host);
    // happy-dom does not implement ShadowRoot.getElementById, which the label uses for its
    // root-scoped control lookup. Delegate to querySelector so the test still exercises the
    // scoping: the lookup must resolve inside the shadow root, not the outer document.
    (shadowRoot as ShadowRoot & { getElementById: (id: string) => Element | null }).getElementById ??= (id: string) =>
      shadowRoot.querySelector(`#${id}`);

    try {
      const { el } = mount(() => (
        <>
          <input aria-label="Unrelated control" data-testid="unrelated" />
          <Portal mount={container}>
            <Field.Root>
              <Field.Control data-testid="control" />
              <Field.Label nativeLabel={false} as="div" data-testid="label">
                Name
              </Field.Label>
            </Field.Root>
          </Portal>
        </>
      ));

      const control = container.querySelector('[data-testid="control"]') as HTMLElement;
      const label = container.querySelector('[data-testid="label"]') as HTMLElement;
      const unrelated = getByTestId(el, "unrelated") as HTMLInputElement;
      expect(control.id).not.toBe("");
      unrelated.id = control.id;

      // Real clicks are composed and cross the shadow boundary to the delegated listener.
      fire(label, "click", { composed: true } as MouseEventInit);
      tick();

      expect(shadowRoot.activeElement).toBe(control);
      expect(document.activeElement).toBe(host);
      expect(unrelated).not.toHaveFocus();
    } finally {
      host.remove();
    }
  });
});

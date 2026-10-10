import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { Portal } from "@solidjs/web";
import { describe, expect, it } from "vite-plus/test";

import { createRenderer, describeConformance } from "#test-utils";

import * as Field from "../index.parts";

describe("<Field.Label />", () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => (
      <Field.Root>
        <Field.Label {...props} />
      </Field.Root>
    ),
    () => ({
      render,
      defaultElement: "label",
      refInstanceof: window.HTMLLabelElement,
      testAsProps: { nativeLabel: false },
    }),
  );

  it("should set htmlFor referencing the control automatically", async () => {
    await render(() => (
      <Field.Root data-testid="field">
        <Field.Control />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    expect(screen.getByTestId("label")).toHaveAttribute("for", screen.getByRole("textbox").id);
  });

  it("when nativeLabel={false}, clicking focuses the associated control", async () => {
    const { user } = await render(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
        <Field.Label nativeLabel={false} as="div" data-testid="label">
          Label
        </Field.Label>
      </Field.Root>
    ));

    const label = screen.getByTestId("label");
    const control = screen.getByTestId("control");

    expect(label).not.toHaveAttribute("for");

    await user.click(label);
    expect(control).toHaveFocus();
  });

  it("reflects the disabled state from Field.Item", async () => {
    await render(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Item>
      </Field.Root>
    ));

    expect(screen.getByTestId("label")).toHaveAttribute("data-disabled");
  });

  it("focuses the control in its shadow root when the outer document has a matching ID", async () => {
    const host = document.createElement("div");
    const shadowRoot = host.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    shadowRoot.appendChild(container);
    document.body.appendChild(host);

    try {
      const { user } = await render(() => (
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
      const unrelated = screen.getByTestId("unrelated") as HTMLInputElement;
      expect(control.id).not.toBe("");
      unrelated.id = control.id;

      await user.click(label);

      expect(shadowRoot.activeElement).toBe(control);
      expect(document.activeElement).toBe(host);
      expect(unrelated).not.toHaveFocus();
    } finally {
      host.remove();
    }
  });
});

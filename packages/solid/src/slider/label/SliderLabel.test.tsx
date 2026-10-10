import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { Portal } from "@solidjs/web";
import { describe, expect, it } from "vite-plus/test";

import { createRenderer } from "#test-utils";

import { Field } from "../../field";
import { SliderControl } from "../control/SliderControl";
import { SliderRoot } from "../root/SliderRoot";
import { SliderThumb } from "../thumb/SliderThumb";
import { SliderLabel } from "./SliderLabel";

describe("<Slider.Label />", () => {
  const { render } = createRenderer();

  it("focuses the thumb in its shadow root when the outer document has a matching ID", async () => {
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
              <SliderRoot defaultValue={50}>
                <SliderLabel data-testid="label">Volume</SliderLabel>
                <SliderControl>
                  <SliderThumb />
                </SliderControl>
              </SliderRoot>
            </Field.Root>
          </Portal>
        </>
      ));

      const input = container.querySelector('input[type="range"]') as HTMLElement;
      const label = container.querySelector('[data-testid="label"]') as HTMLElement;
      const unrelated = screen.getByTestId("unrelated") as HTMLInputElement;
      expect(input.id).not.toBe("");
      unrelated.id = input.id;

      await user.click(label);

      expect(shadowRoot.activeElement).toBe(input);
      expect(document.activeElement).toBe(host);
      expect(unrelated).not.toHaveFocus();
    } finally {
      host.remove();
    }
  });
});

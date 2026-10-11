import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { Portal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Field } from "../../field";
import { SliderControl } from "../control/SliderControl";
import { SliderRoot } from "../root/SliderRoot";
import { SliderThumb } from "../thumb/SliderThumb";
import { SliderLabel } from "./SliderLabel";

afterEach(cleanup);

describe("<Slider.Label />", () => {
  it("focuses the thumb in its shadow root when the outer document has a matching ID", () => {
    const host = document.createElement("div");
    const shadowRoot = host.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    shadowRoot.appendChild(container);
    document.body.appendChild(host);

    try {
      mount(() => (
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
      tick();

      const input = container.querySelector('input[type="range"]') as HTMLElement;
      const label = container.querySelector('[data-testid="label"]') as HTMLElement;
      const unrelated = screen.getByTestId("unrelated") as HTMLInputElement;
      expect(input.id).not.toBe("");
      unrelated.id = input.id;

      // Composed like a real browser click so it reaches the document-level listener.
      label.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
      tick();

      expect(shadowRoot.activeElement).toBe(input);
      expect(document.activeElement).toBe(host);
      expect(unrelated).not.toHaveFocus();
    } finally {
      host.remove();
    }
  });
});

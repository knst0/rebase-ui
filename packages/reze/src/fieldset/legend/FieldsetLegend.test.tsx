import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as Fieldset from "../index.parts";

afterEach(cleanup);

function getLegend(root: ParentNode): HTMLElement {
  const found = root.querySelector('[data-testid="legend"]');
  if (!(found instanceof HTMLElement)) {
    throw new Error("legend not found");
  }
  return found;
}

function getFieldset(root: ParentNode): HTMLFieldSetElement {
  const found = root.querySelector("fieldset");
  if (!(found instanceof HTMLFieldSetElement)) {
    throw new Error("fieldset not found");
  }
  return found;
}

describe("<Fieldset.Legend />", () => {
  it("renders a div element by default", () => {
    const { el } = mount(() => (
      <Fieldset.Root>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));

    expect(getLegend(el).tagName).toBe("DIV");
  });

  it("sets aria-labelledby on the fieldset automatically", () => {
    const { el } = mount(() => (
      <Fieldset.Root>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));
    tick();

    const legend = getLegend(el);
    expect(legend.id).not.toBe("");
    expect(getFieldset(el)).toHaveAttribute("aria-labelledby", legend.id);
  });

  it("sets aria-labelledby on the fieldset with a custom id", () => {
    const { el } = mount(() => (
      <Fieldset.Root>
        <Fieldset.Legend id="legend-id" data-testid="legend" />
      </Fieldset.Root>
    ));
    tick();

    expect(getLegend(el).id).toBe("legend-id");
    expect(getFieldset(el)).toHaveAttribute("aria-labelledby", "legend-id");
  });

  it("updates and clears the legend association", () => {
    function Test() {
      let legendId = signal("legend-a");
      let showLegend = signal(true);
      return (
        <>
          <Fieldset.Root>{showLegend ? <Fieldset.Legend id={legendId}>Legend</Fieldset.Legend> : null}</Fieldset.Root>
          <button
            data-testid="rename"
            onClick={() => {
              legendId = "legend-b";
            }}
          >
            rename
          </button>
          <button
            data-testid="remove"
            onClick={() => {
              showLegend = false;
            }}
          >
            remove
          </button>
        </>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    const fieldset = getFieldset(el);
    expect(fieldset).toHaveAttribute("aria-labelledby", "legend-a");

    fire(el.querySelector('[data-testid="rename"]')!, "click");
    tick();
    expect(fieldset).toHaveAttribute("aria-labelledby", "legend-b");

    fire(el.querySelector('[data-testid="remove"]')!, "click");
    tick();
    expect(fieldset).not.toHaveAttribute("aria-labelledby");
  });

  it("reflects the fieldset disabled state", () => {
    const { el } = mount(() => (
      <Fieldset.Root disabled>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));
    tick();

    expect(getLegend(el)).toHaveAttribute("data-disabled", "");
  });

  it("throws a descriptive error when rendered outside <Fieldset.Root>", () => {
    expect(() => mount(() => <Fieldset.Legend />)).toThrow(
      "Rebase UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.",
    );
  });

  describe("prop: as", () => {
    it("renders the customized legend element", () => {
      const { el } = mount(() => (
        <Fieldset.Root>
          <Fieldset.Legend as="legend" data-testid="legend">
            Legend
          </Fieldset.Legend>
        </Fieldset.Root>
      ));

      expect(getLegend(el).tagName).toBe("LEGEND");
    });
  });

  describe("prop: class", () => {
    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Fieldset.Root disabled>
          <Fieldset.Legend
            data-testid="legend"
            class={(state) => {
              stateArgument = state;
              return "";
            }}
          />
        </Fieldset.Root>
      ));

      expect(getLegend(el)).toBeTruthy();
      expect(stateArgument).toEqual({ disabled: true });
    });
  });

  describe("ref forwarding", () => {
    it("attaches a callback ref to the legend element", () => {
      let instance: HTMLElement | null = null;
      const { el } = mount(() => (
        <Fieldset.Root>
          <Fieldset.Legend
            data-testid="legend"
            ref={(value: HTMLElement) => {
              instance = value;
            }}
          />
        </Fieldset.Root>
      ));

      expect(instance).toBe(getLegend(el));
    });
  });
});

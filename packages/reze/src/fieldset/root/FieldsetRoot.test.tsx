import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as Fieldset from "../index.parts";

afterEach(cleanup);

function getFieldset(root: ParentNode): HTMLFieldSetElement {
  const found = root.querySelector("fieldset");
  if (!(found instanceof HTMLFieldSetElement)) {
    throw new Error("fieldset not found");
  }
  return found;
}

describe("<Fieldset.Root />", () => {
  it("renders a fieldset element by default", () => {
    const { el } = mount(() => <Fieldset.Root />);

    expect(getFieldset(el).tagName).toBe("FIELDSET");
  });

  it("sets the native disabled attribute", () => {
    const { el } = mount(() => (
      <Fieldset.Root disabled data-testid="fieldset">
        <input />
      </Fieldset.Root>
    ));

    expect(getFieldset(el)).toHaveAttribute("disabled");
    expect(getFieldset(el)).toHaveAttribute("data-disabled", "");
    expect(el.querySelector("input")).toBeDisabled();
  });

  it("keeps nested fieldsets disabled when an ancestor fieldset is disabled", () => {
    let innerState: unknown;
    mount(() => (
      <Fieldset.Root disabled>
        <Fieldset.Root>
          {(state) => {
            innerState = state;
            return null;
          }}
        </Fieldset.Root>
      </Fieldset.Root>
    ));

    expect(innerState).toEqual({ disabled: true });
  });

  it("updates nested disabled precedence in both directions", () => {
    function Test() {
      let outerDisabled = signal(false);
      let innerDisabled = signal(true);
      return (
        <>
          <Fieldset.Root disabled={outerDisabled}>
            <Fieldset.Root disabled={innerDisabled} data-testid="inner">
              {(state) => (state.disabled ? "disabled" : "enabled")}
            </Fieldset.Root>
          </Fieldset.Root>
          <button
            data-testid="outer-only"
            onClick={() => {
              outerDisabled = true;
              innerDisabled = false;
            }}
          >
            outer only
          </button>
          <button
            data-testid="none"
            onClick={() => {
              outerDisabled = false;
            }}
          >
            none
          </button>
        </>
      );
    }
    const { el } = mount(() => <Test />);

    const inner = () => el.querySelector('[data-testid="inner"]')!;
    expect(inner().textContent).toBe("disabled");

    fire(el.querySelector('[data-testid="outer-only"]')!, "click");
    tick();
    expect(inner().textContent).toBe("disabled");

    fire(el.querySelector('[data-testid="none"]')!, "click");
    tick();
    expect(inner().textContent).toBe("enabled");
  });

  it("updates the disabled attribute when the prop changes", () => {
    function Test() {
      let disabled = signal(false);
      return (
        <>
          <Fieldset.Root disabled={disabled} />
          <button onClick={() => (disabled = true)}>Disable</button>
        </>
      );
    }
    const { el } = mount(() => <Test />);

    const fieldset = getFieldset(el);
    expect(fieldset).not.toHaveAttribute("disabled");
    expect(fieldset).not.toHaveAttribute("data-disabled");

    fire(el.querySelector("button")!, "click");
    tick();

    expect(fieldset).toHaveAttribute("disabled");
    expect(fieldset).toHaveAttribute("data-disabled", "");
  });

  describe("prop: as", () => {
    it("renders the customized root element", () => {
      const { el } = mount(() => <Fieldset.Root as="div" data-testid="root" />);

      expect(el.querySelector('[data-testid="root"]')?.tagName).toBe("DIV");
    });
  });

  describe("prop: class", () => {
    it("applies the class when passed as a string", () => {
      const { el } = mount(() => <Fieldset.Root class="test-class" />);

      expect(getFieldset(el).classList.contains("test-class")).toBe(true);
    });

    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Fieldset.Root
          disabled
          class={(state) => {
            stateArgument = state;
            return "";
          }}
        />
      ));

      expect(getFieldset(el)).toBeTruthy();
      expect(stateArgument).toEqual({ disabled: true });
    });

    it("updates the class when the state changes", () => {
      function Test() {
        let disabled = signal(false);
        return (
          <>
            <Fieldset.Root disabled={disabled} class={(state) => (state.disabled ? "is-disabled" : "is-enabled")} />
            <button onClick={() => (disabled = true)}>Disable</button>
          </>
        );
      }
      const { el } = mount(() => <Test />);

      const fieldset = getFieldset(el);
      expect(fieldset.classList.contains("is-enabled")).toBe(true);

      fire(el.querySelector("button")!, "click");
      tick();

      expect(fieldset.classList.contains("is-disabled")).toBe(true);
      expect(fieldset.classList.contains("is-enabled")).toBe(false);
    });
  });

  describe("prop forwarding", () => {
    it("forwards custom props to the root element", () => {
      const { el } = mount(() => <Fieldset.Root lang="fr" data-foobar="test-value" />);

      const fieldset = getFieldset(el);
      expect(fieldset.getAttribute("lang")).toBe("fr");
      expect(fieldset.getAttribute("data-foobar")).toBe("test-value");
    });

    it("forwards the style prop", () => {
      const { el } = mount(() => <Fieldset.Root style={{ color: "green" }} />);

      expect(getFieldset(el).style.color).toBe("green");
    });

    it("forwards the style prop defined as a function of state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Fieldset.Root
          style={(state) => {
            stateArgument = state;
            return { color: "green" };
          }}
        />
      ));

      expect(getFieldset(el).style.color).toBe("green");
      expect(stateArgument).toEqual({ disabled: false });
    });

    it("renders children defined as a function of state", () => {
      const { el } = mount(() => <Fieldset.Root disabled>{(state) => (state.disabled ? "D" : "E")}</Fieldset.Root>);

      expect(getFieldset(el).textContent).toBe("D");
    });
  });

  describe("ref forwarding", () => {
    it("attaches a callback ref to the root element", () => {
      let instance: HTMLElement | null = null;
      const { el } = mount(() => (
        <Fieldset.Root
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        />
      ));

      expect(instance).toBe(getFieldset(el));
    });

    it("attaches an identifier ref to the root element", () => {
      // oxlint-disable-next-line no-unassigned-vars -- the compiled ref assigns it
      let instance!: HTMLFieldSetElement;
      const { el } = mount(() => <Fieldset.Root ref={instance} />);

      expect(instance).toBe(getFieldset(el));
    });
  });
});

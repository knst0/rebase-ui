import { render, screen } from "@solidjs/testing-library";
import type { ComponentProps, JSX } from "@solidjs/web";
import { describe, expect, it, vi } from "vitest";

export type ConformantComponentRender = (props: ComponentProps<any>) => JSX.Element;

export type ConformanceOptions = {
  defaultElement?: keyof JSX.IntrinsicElements;
  as?: { targetElement: keyof JSX.IntrinsicElements };
  stateAttributes?: Record<string, string> | undefined;
  refInstanceof?: abstract new (...args: any[]) => any;
};

function randomStringValue(prefix = "test") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function describeConformance(
  renderComponent: ConformantComponentRender,
  optionsOrFactory: ConformanceOptions | (() => ConformanceOptions),
) {
  const options = typeof optionsOrFactory === "function" ? optionsOrFactory() : optionsOrFactory;
  function renderRoot(props?: ComponentProps<any>) {
    const testId = randomStringValue();
    render(() => renderComponent({ "data-testid": testId, ...props }));
    return screen.getByTestId(testId);
  }

  describe("component API", () => {
    it("renders the default root element", () => {
      const element = renderRoot();
      expect(element.tagName).toBe(options.defaultElement!.toUpperCase());
    });

    describe.skipIf(!options.as)("prop: as", () => {
      it("renders the customized root element", () => {
        const as = options.as!.targetElement;
        const element = renderRoot({ as });
        expect(element.tagName).toBe(as.toUpperCase());
      });
    });

    describe("prop: class", () => {
      it("applies the class when passed as a string", () => {
        const element = renderRoot({ class: "test-class" });
        expect(element.classList.contains("test-class")).toBe(true);
      });

      it("applies the class when passed as a function of state", () => {
        const element = renderRoot({ class: () => "test-class" });
        expect(element.classList.contains("test-class")).toBe(true);
      });

      it("calls the class function with the component state", () => {
        let stateArgument: unknown;

        renderRoot({
          class: (state: unknown) => {
            stateArgument = state;
            return "";
          },
        });

        expect(typeof stateArgument).toBe("object");
        expect(stateArgument).not.toBe(null);
      });

      it("applies every class when passed as an array", () => {
        const element = renderRoot({ class: ["test-class-1", () => "test-class-2"] });
        expect(element.classList.contains("test-class-1")).toBe(true);
        expect(element.classList.contains("test-class-2")).toBe(true);
      });

      it("preserves the classes the component sets itself", () => {
        const ownClasses = [...renderRoot().classList];

        const root = renderRoot({ class: "test-class" });

        for (const ownClass of ownClasses) {
          expect(root.classList.contains(ownClass)).toBe(true);
        }
        expect(root.classList.contains("test-class")).toBe(true);
      });
    });

    describe.skipIf(!options.stateAttributes)("state `data-*` attributes", () => {
      const stateAttributes = options.stateAttributes!;

      it("renders the expected `data-*` attributes in the default state", () => {
        const element = renderRoot();

        for (const [name, value] of Object.entries(stateAttributes)) {
          expect(element).toHaveAttribute(name, value);
        }
      });

      it("does not let forwarded props drop the state `data-*` attributes", () => {
        const element = renderRoot({ "data-foobar": "test-value" });

        for (const [name, value] of Object.entries(stateAttributes)) {
          expect(element).toHaveAttribute(name, value);
        }
        expect(element).toHaveAttribute("data-foobar", "test-value");
      });
    });

    describe("ref forwarding", () => {
      it("attaches the ref to the root element", () => {
        let instance: HTMLElement | null = null;
        const element = renderRoot({
          ref: (value: HTMLElement | null) => {
            instance = value;
          },
        });

        expect(instance).not.toBe(null);
        expect(instance).toBeInstanceOf(options.refInstanceof ?? window.HTMLElement);
        expect(instance).toBe(element);
      });

      it("keeps forwarding the other props when a ref is provided", () => {
        const element = renderRoot({ ref: () => {}, "data-foobar": "test-value" });

        expect(element).toHaveAttribute("data-foobar", "test-value");
      });
    });

    describe("prop forwarding", () => {
      it("forwards custom props to the root element", () => {
        const element = renderRoot({ lang: "fr", "data-foobar": "test-value" });

        expect(element).toHaveAttribute("lang", "fr");
        expect(element).toHaveAttribute("data-foobar", "test-value");
      });

      it("forwards `aria-*` props to the root element", () => {
        expect(renderRoot({ "aria-label": "Test label" })).toHaveAttribute("aria-label", "Test label");
      });

      it("forwards the `style` prop", () => {
        expect((renderRoot({ style: { color: "green" } }) as HTMLElement).style.color).toBe("green");
      });

      it("forwards the `style` prop defined as a function of state", () => {
        expect((renderRoot({ style: () => ({ color: "green" }) }) as HTMLElement).style.color).toBe("green");
      });

      it("calls the style function with the component state", () => {
        let stateArgument: unknown;

        renderRoot({
          style: (state: unknown) => {
            stateArgument = state;
            return {};
          },
        });

        expect(typeof stateArgument).toBe("object");
        expect(stateArgument).not.toBe(null);
      });

      it("forwards event handlers to the root element", () => {
        const handleClick = vi.fn();
        const element = renderRoot({ onClick: handleClick });

        element.click();

        expect(handleClick).toHaveBeenCalledTimes(1);
      });
    });
  });
}

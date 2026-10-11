import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Separator } from "./Separator";

afterEach(cleanup);

function getSeparator(root: ParentNode): HTMLElement {
  const found = root.querySelector('[role="separator"]');
  if (!(found instanceof HTMLElement)) {
    throw new Error("separator not found");
  }
  return found;
}

describe("<Separator />", () => {
  it("renders a div with separator semantics by default", () => {
    const { el } = mount(() => <Separator />);

    const separator = getSeparator(el);
    expect(separator.tagName).toBe("DIV");
    expect(separator.getAttribute("aria-orientation")).toBe("horizontal");
  });

  describe("prop: orientation", () => {
    (["horizontal", "vertical"] as const).forEach((orientation) => {
      it(orientation, () => {
        const { el } = mount(() => <Separator orientation={orientation} />);

        expect(getSeparator(el).getAttribute("aria-orientation")).toBe(orientation);
      });
    });

    it("updates aria-orientation when the prop changes", () => {
      function Test() {
        let orientation: "horizontal" | "vertical" = signal("horizontal");
        return (
          <>
            <Separator orientation={orientation} />
            <button onClick={() => (orientation = "vertical")}>Flip</button>
          </>
        );
      }
      const { el } = mount(() => <Test />);

      const separator = getSeparator(el);
      expect(separator.getAttribute("aria-orientation")).toBe("horizontal");

      fire(el.querySelector("button")!, "click");
      tick();

      expect(separator.getAttribute("aria-orientation")).toBe("vertical");
    });
  });

  describe("prop: as", () => {
    it("renders the customized root element", () => {
      const { el } = mount(() => <Separator as="span" />);

      expect(getSeparator(el).tagName).toBe("SPAN");
    });

    it("supports component values", () => {
      function Fancy(props: Record<string, unknown>) {
        // Spread (not explicit bindings): reze-lsp's intrinsic attribute table
        // lacks `role`, so an explicit `role=` warns UNKNOWN_ATTRIBUTE here.
        // The rendered output is identical.
        const forwarded = {
          role: props.role as "separator",
          "aria-orientation": props["aria-orientation"] as "horizontal" | "vertical",
        };
        return (
          <div data-fancy="true" {...forwarded}>
            {props.children as never}
          </div>
        );
      }
      const { el } = mount(() => <Separator as={Fancy} orientation="vertical" />);

      const section = el.querySelector("div");
      expect(section?.getAttribute("data-fancy")).toBe("true");
      expect(section?.getAttribute("role")).toBe("separator");
      expect(section?.getAttribute("aria-orientation")).toBe("vertical");
    });
  });

  describe("prop: class", () => {
    it("applies the class when passed as a string", () => {
      const { el } = mount(() => <Separator class="test-class" />);

      expect(getSeparator(el).classList.contains("test-class")).toBe(true);
    });

    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Separator
          orientation="vertical"
          class={(state) => {
            stateArgument = state;
            return "";
          }}
        />
      ));

      expect(getSeparator(el)).toBeTruthy();
      expect(stateArgument).toEqual({ orientation: "vertical" });
    });

    it("updates the class when the state changes", () => {
      function Test() {
        let orientation: "horizontal" | "vertical" = signal("horizontal");
        return (
          <>
            <Separator orientation={orientation} class={(state) => (state.orientation === "vertical" ? "is-vertical" : "is-horizontal")} />
            <button onClick={() => (orientation = "vertical")}>Flip</button>
          </>
        );
      }
      const { el } = mount(() => <Test />);

      const separator = getSeparator(el);
      expect(separator.classList.contains("is-horizontal")).toBe(true);

      fire(el.querySelector("button")!, "click");
      tick();

      expect(separator.classList.contains("is-vertical")).toBe(true);
      expect(separator.classList.contains("is-horizontal")).toBe(false);
    });
  });

  describe("prop forwarding", () => {
    it("forwards custom props to the root element", () => {
      const { el } = mount(() => <Separator lang="fr" data-foobar="test-value" />);

      const separator = getSeparator(el);
      expect(separator.getAttribute("lang")).toBe("fr");
      expect(separator.getAttribute("data-foobar")).toBe("test-value");
    });

    it("internal separator semantics win over forwarded props", () => {
      const { el } = mount(() => <Separator role="presentation" aria-orientation="vertical" />);

      const separator = getSeparator(el);
      expect(separator.getAttribute("role")).toBe("separator");
      expect(separator.getAttribute("aria-orientation")).toBe("horizontal");
    });

    it("forwards the style prop", () => {
      const { el } = mount(() => <Separator style={{ color: "green" }} />);

      expect(getSeparator(el).style.color).toBe("green");
    });

    it("forwards the style prop defined as a function of state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Separator
          style={(state) => {
            stateArgument = state;
            return { color: "green" };
          }}
        />
      ));

      expect(getSeparator(el).style.color).toBe("green");
      expect(stateArgument).toEqual({ orientation: "horizontal" });
    });

    it("renders children defined as a function of state", () => {
      const { el } = mount(() => <Separator orientation="vertical">{(state) => (state.orientation === "vertical" ? "V" : "H")}</Separator>);

      expect(getSeparator(el).textContent).toBe("V");
    });
  });

  describe("ref forwarding", () => {
    it("attaches a callback ref to the root element", () => {
      let instance: HTMLElement | null = null;
      const { el } = mount(() => (
        <Separator
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        />
      ));

      expect(instance).toBe(getSeparator(el));
    });

    it("attaches an identifier ref to the root element", () => {
      // oxlint-disable-next-line no-unassigned-vars -- the compiled ref assigns it
      let instance!: HTMLDivElement;
      const { el } = mount(() => <Separator ref={instance} />);

      expect(instance).toBe(getSeparator(el));
    });
  });
});

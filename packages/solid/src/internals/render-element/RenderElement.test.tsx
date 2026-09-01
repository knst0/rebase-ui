import { render } from "@solidjs/testing-library";
import type { JSX } from "@solidjs/web";
import { type Accessor, createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_OBJECT } from "#utils";

import { RenderElement } from "./RenderElement";

function CustomComponent(props: { class?: string; id?: string; ref?: (element: HTMLDivElement) => void }) {
  return <div id={props.id} class={props.class} ref={props.ref} />;
}

function renderRoot(ui: JSX.Element) {
  const { container } = render(() => ui);
  return { container, root: container.querySelector("div")! };
}

describe("<RenderElement />", () => {
  it("returns null when enabled is false", () => {
    const { container } = render(() => <RenderElement as="div" enabled={() => false} />);
    expect(container.innerHTML).toBe("");
  });

  it("resolves class as a function of state", () => {
    const { root: element } = renderRoot(
      <RenderElement as="div" state={{ active: () => true }} props={{ class: (state) => (state.active() ? "active" : "inactive") }} />,
    );
    expect(element?.classList.contains("active")).toBe(true);
  });

  it("re-resolves class when state changes", () => {
    const [active, setActive] = createSignal(false);
    const { root: element } = renderRoot(
      <RenderElement as="div" state={{ active }} props={{ class: (state) => (state.active() ? "active" : "inactive") }} />,
    );
    expect(element.classList.contains("inactive")).toBe(true);
    setActive(true);
    flush();
    expect(element.classList.contains("active")).toBe(true);
  });

  it("composes class arrays with function entries", () => {
    const { root: element } = renderRoot(
      <RenderElement
        as="div"
        state={{ active: () => true }}
        props={{
          class: [(state) => (state.active() ? "active" : "inactive"), "static-class"],
        }}
      />,
    );
    expect(element.classList.contains("active")).toBe(true);
    expect(element.classList.contains("static-class")).toBe(true);
  });

  it("renders state as data attributes", () => {
    const { root: element } = renderRoot(
      <RenderElement
        as="div"
        state={{
          active: () => true,
          hidden: () => false,
          count: () => 2,
          name: () => "test",
        }}
      />,
    );
    expect(element.hasAttribute("data-active")).toBe(true);
    expect(element.getAttribute("data-active")).toBe("");
    expect(element.hasAttribute("data-hidden")).toBe(false);
    expect(element.getAttribute("data-count")).toBe("2");
    expect(element.getAttribute("data-name")).toBe("test");
  });

  it("removes data attributes when state becomes false", () => {
    const [active, setActive] = createSignal(true);
    const { container } = render(() => <RenderElement as="div" state={{ active }} />);
    const element = container.querySelector("div")!;
    expect(element.hasAttribute("data-active")).toBe(true);
    setActive(false);
    flush();
    expect(element.hasAttribute("data-active")).toBe(false);
  });

  it("uses the state attributes mapping", () => {
    const { root: element } = renderRoot(
      <RenderElement
        as="div"
        state={{ active: () => true }}
        stateAttributesMapping={{
          active: (active) => ({ "data-active": active ? "true" : "false" }),
        }}
      />,
    );
    expect(element.getAttribute("data-active")).toBe("true");
  });

  it("skips attributes mapped to null", () => {
    const { container } = render(() => (
      <RenderElement as="div" state={{ active: () => true, hidden: () => true }} stateAttributesMapping={{ active: () => null }} />
    ));
    const element = container.querySelector("div")!;
    expect(element.hasAttribute("data-active")).toBe(false);
    expect(element.hasAttribute("data-hidden")).toBe(true);
  });

  it("merges prop sources with later sources winning", () => {
    const { container } = render(() => <RenderElement as="div" props={[{ id: "first", class: "first-class" }, { id: "second" }]} />);
    const element = container.querySelector("div")!;
    expect(element.id).toBe("second");
    expect(element.classList.contains("first-class")).toBe(true);
  });

  it("resolves function prop sources with the merged props", () => {
    const { container } = render(() => (
      <RenderElement as="div" props={[{ id: "base" }, (merged: { id?: string | false }) => ({ id: `${merged.id}-suffix` })]} />
    ));
    const element = container.querySelector("div")!;
    expect(element.id).toBe("base-suffix");
  });

  it("re-resolves function prop sources when state changes", () => {
    const [label, setLabel] = createSignal("first");
    const { container } = render(() => (
      <RenderElement as="div" props={[{ id: "base" }, (merged: { id?: string | false }) => ({ id: `${label()}-${merged.id}` })]} />
    ));
    const element = container.querySelector("div")!;
    expect(element.id).toBe("first-base");
    setLabel("second");
    flush();
    expect(element.id).toBe("second-base");
  });

  it("does not resolve props when disabled", () => {
    const propsResolver = vi.fn();
    const [enabled, setEnabled] = createSignal(false);
    const { container } = render(() => (
      <RenderElement
        as="div"
        enabled={enabled}
        props={[
          () => {
            propsResolver();
            return {};
          },
        ]}
      />
    ));
    expect(propsResolver).not.toHaveBeenCalled();
    setEnabled(true);
    flush();
    expect(container.querySelector("div")).not.toBeNull();
    expect(propsResolver).toHaveBeenCalledTimes(1);
  });

  it("calls ref and onClick when re-enabled", () => {
    const ref = vi.fn();
    const onClick = vi.fn();
    const [enabled, setEnabled] = createSignal(true);
    const { container, root: element } = renderRoot(<RenderElement as="div" enabled={enabled} props={{ id: "test", ref, onClick }} />);
    expect(element.id).toBe("test");
    expect(ref).toHaveBeenCalledTimes(1);
    element.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    setEnabled(false);
    flush();
    expect(container.querySelector("div")).toBeNull();
    setEnabled(true);
    flush();
    const reEnabledElement = container.querySelector("div")!;
    expect(reEnabledElement).not.toBe(element);
    expect(reEnabledElement.id).toBe("test");
    expect(ref).toHaveBeenCalledTimes(2);
    reEnabledElement.click();
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("renders a custom component with resolved props and ref", () => {
    const ref = vi.fn();
    const { container } = render(() => (
      <RenderElement
        as={CustomComponent}
        state={{ active: () => true }}
        props={{ class: (state) => (state.active() ? "active" : ""), ref }}
      />
    ));
    const element = container.querySelector("div")!;
    expect(element.classList.contains("active")).toBe(true);
    expect(ref).toHaveBeenCalledWith(element);
  });

  it("chains refs from every prop source", () => {
    const calls: string[] = [];
    const internalRef = (element: HTMLElement) => calls.push(`internal:${element.tagName}`);
    const externalRef = (element: HTMLElement) => calls.push(`external:${element.tagName}`);

    const { container } = render(() => <RenderElement as="div" props={[{ ref: internalRef }, { ref: externalRef }]} />);

    const element = container.querySelector("div")!;
    expect(calls).toEqual(["internal:DIV", "external:DIV"]);
    expect(element).not.toBeNull();
  });

  it("lets a function prop source replace the refs it received", () => {
    const earlierRef = vi.fn();
    const replacementRef = vi.fn();

    const { container } = render(() => <RenderElement as="div" props={[{ ref: earlierRef }, () => ({ ref: replacementRef })]} />);

    const element = container.querySelector("div")!;
    expect(earlierRef).not.toHaveBeenCalled();
    expect(replacementRef).toHaveBeenCalledWith(element);
  });

  it("calls a ref merged by a function prop source exactly once", () => {
    const externalRef = vi.fn();
    const ownRef = vi.fn();

    const { container } = render(() => (
      <RenderElement
        as="div"
        props={[
          { ref: externalRef },
          (externalProps: Record<string, any>) => ({
            ref: (element: HTMLDivElement) => {
              externalProps.ref?.(element);
              ownRef(element);
            },
          }),
        ]}
      />
    ));

    const element = container.querySelector("div")!;
    expect(externalRef).toHaveBeenCalledTimes(1);
    expect(externalRef).toHaveBeenCalledWith(element);
    expect(ownRef).toHaveBeenCalledTimes(1);
  });

  it("calls a chained ref only once when the same ref appears in several sources", () => {
    const ref = vi.fn();

    const { container } = render(() => <RenderElement as="div" props={[{ ref }, { ref }, { id: "test" }]} />);

    expect(ref).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledWith(container.querySelector("div"));
  });

  it("chains refs on a custom component", () => {
    const internalRef = vi.fn();
    const externalRef = vi.fn();

    const { container } = render(() => <RenderElement as={CustomComponent} props={[{ ref: internalRef }, { ref: externalRef }]} />);

    const element = container.querySelector("div")!;
    expect(internalRef).toHaveBeenCalledWith(element);
    expect(externalRef).toHaveBeenCalledWith(element);
  });

  it("accepts EMPTY_OBJECT-derived state that has been mutated", () => {
    const state: Record<string, Accessor<unknown>> = { ...EMPTY_OBJECT };
    state.mutated = () => true;
    expect(() => render(() => <RenderElement as="div" state={state} />)).not.toThrow();
  });
});

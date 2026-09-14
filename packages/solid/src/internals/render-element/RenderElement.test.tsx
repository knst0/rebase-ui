import { render } from "@solidjs/testing-library";
import type { JSX } from "@solidjs/web";
import { type Accessor, createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_OBJECT } from "#utils/empty";

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

  it("resolves class callbacks once per state change instead of once per read", () => {
    const entry = vi.fn((state: any) => (state.active() ? "on" : "off"));
    let captured: Record<string, any> | undefined;

    function Capture(props: Record<string, any>) {
      captured = props;
      return <div />;
    }

    const [active, setActive] = createSignal(false);
    render(() => <RenderElement as={Capture} state={{ active }} props={{ class: [entry, "static"] }} />);

    expect(captured?.class).toContain("static");
    const callsAfterFirstRead = entry.mock.calls.length;

    void captured?.class;
    void captured?.class;
    expect(entry.mock.calls.length).toBe(callsAfterFirstRead);

    setActive(true);
    flush();
    expect(captured?.class).toContain("on");
    expect(entry.mock.calls.length).toBeGreaterThan(callsAfterFirstRead);
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
          active: { keys: ["data-active"], map: (active) => ({ "data-active": active ? "true" : "false" }) },
        }}
      />,
    );
    expect(element.getAttribute("data-active")).toBe("true");
  });

  it("skips attributes mapped to null", () => {
    const { container } = render(() => (
      <RenderElement
        as="div"
        state={{ active: () => true, hidden: () => true }}
        stateAttributesMapping={{ active: { keys: [], map: () => null } }}
      />
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

  it("applies keys a function prop source publishes after mount", () => {
    // Interaction props are published from an effect, so a layer's key set is
    // not final during the first render.
    const [extra, setExtra] = createSignal<Record<string, string>>({}, { ownedWrite: true });
    const { container } = render(() => <RenderElement as="div" props={[{ id: "base" }, () => extra()]} />);
    const element = container.querySelector("div")!;
    expect(element.getAttribute("role")).toBeNull();

    setExtra({ role: "combobox", "aria-expanded": "false" });
    flush();
    expect(element.getAttribute("role")).toBe("combobox");
    expect(element.getAttribute("aria-expanded")).toBe("false");

    setExtra({ role: "combobox", "aria-expanded": "true" });
    flush();
    expect(element.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps a later function source out of an earlier one's dependencies", () => {
    // Reading one key must not subscribe the reader to unrelated layers, or a
    // ref layer would be rebuilt whenever any other layer changes.
    const [title, setTitle] = createSignal("first");
    const resolved = vi.fn();
    const { container } = render(() => (
      <RenderElement
        as="div"
        props={[
          { id: "base" },
          () => ({ title: title() }),
          (external): Record<string, unknown> => {
            resolved();
            return { "data-id": external.id };
          },
        ]}
      />
    ));
    const element = container.querySelector("div")!;
    expect(element.getAttribute("data-id")).toBe("base");
    expect(resolved).toHaveBeenCalledTimes(1);

    setTitle("second");
    flush();
    expect(element.getAttribute("title")).toBe("second");
    expect(resolved).toHaveBeenCalledTimes(1);
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

describe("<RenderElement /> prop layers", () => {
  it("keeps a props proxy dynamic when its keys appear after creation", () => {
    function Wrapper(props: Record<string, any>) {
      return <RenderElement as="div" props={[{ class: "base" }, props]} />;
    }

    const [extra, setExtra] = createSignal<string | undefined>(undefined, { ownedWrite: true });
    const { container } = render(() => <Wrapper id="wrapped" title={extra()} />);
    const element = container.querySelector("div")!;

    expect(element.id).toBe("wrapped");
    expect(element.classList.contains("base")).toBe(true);

    setExtra("late");
    flush();
    expect(element.getAttribute("title")).toBe("late");
  });

  it("lets a later source win a key contributed by a props proxy", () => {
    function Wrapper(props: Record<string, any>) {
      return <RenderElement as="div" props={[props, { id: "last" }]} />;
    }
    const { container } = render(() => <Wrapper id="first" />);

    expect(container.querySelector("div")!.id).toBe("last");
  });

  it("passes the layers below a function source to that source", () => {
    const seen: Array<Record<string, any>> = [];
    const { container } = render(() => (
      <RenderElement
        as="div"
        state={{ active: () => true }}
        props={[
          { id: "base", title: "kept" },
          (external) => {
            seen.push({ ...external });
            return { id: "override" };
          },
        ]}
      />
    ));

    const element = container.querySelector("div")!;
    expect(element.id).toBe("override");
    expect(element.getAttribute("title")).toBe("kept");
    expect(seen).toHaveLength(1);
    expect(seen[0].id).toBe("base");
    expect(seen[0].title).toBe("kept");
    // A DOM element binds its state straight to attributes, so state never
    // becomes a prop layer.
    expect(seen[0]["data-active"]).toBeUndefined();
  });

  it("gives a custom component's function source the state attribute layer", () => {
    let seen: Record<string, any> | undefined;

    render(() => (
      <RenderElement
        as={CustomComponent}
        state={{ active: () => true }}
        props={[
          { id: "base" },
          (external: Record<string, any>) => {
            seen = { ...external };
            return {};
          },
        ]}
      />
    ));

    expect(seen?.id).toBe("base");
    expect(seen?.["data-active"]).toBe("");
  });

  it("stacks two function sources so each sees the one before it", () => {
    const { container } = render(() => (
      <RenderElement
        as="div"
        props={[
          { id: "a" },
          (external) => ({ title: external.id }),
          (external): Record<string, any> => ({ "data-seen": `${external.id}:${external.title}` }),
        ]}
      />
    ));

    const element = container.querySelector("div")!;
    expect(element.getAttribute("title")).toBe("a");
    expect(element.getAttribute("data-seen")).toBe("a:a");
  });

  it("ignores undefined entries in the props array", () => {
    const { container } = render(() => <RenderElement as="div" props={[undefined, { id: "only" }, undefined]} />);
    expect(container.querySelector("div")!.id).toBe("only");
  });

  it("does not let a source define __proto__ or constructor", () => {
    const polluted = { id: "safe" } as Record<string, any>;
    Object.defineProperty(polluted, "__proto__", { value: { polluted: true }, enumerable: true, configurable: true });

    const { container } = render(() => <RenderElement as="div" state={{ active: () => true }} props={[polluted]} />);
    const element = container.querySelector("div")!;

    expect(element.id).toBe("safe");
    expect(({} as any).polluted).toBeUndefined();
  });

  it("keeps state attributes reactive through a collapsed layer stack", () => {
    const [active, setActive] = createSignal(false, { ownedWrite: true });
    const { container } = render(() => <RenderElement as="div" state={{ active }} props={[{ id: "a" }, { title: "b" }]} />);
    const element = container.querySelector("div")!;

    expect(element.hasAttribute("data-active")).toBe(false);
    setActive(true);
    flush();
    expect(element.getAttribute("data-active")).toBe("");
    expect(element.id).toBe("a");
    expect(element.getAttribute("title")).toBe("b");
  });

  it("still resolves class callbacks on a source that also carries a ref", () => {
    let captured: HTMLElement | undefined;
    const { container } = render(() => (
      <RenderElement
        as="div"
        state={{ active: () => true }}
        props={[{ class: (state: any) => (state.active() ? "on" : "off"), ref: (element: HTMLElement) => (captured = element) }]}
      />
    ));

    const element = container.querySelector("div")!;
    expect(element.classList.contains("on")).toBe(true);
    expect(captured).toBe(element);
  });
});

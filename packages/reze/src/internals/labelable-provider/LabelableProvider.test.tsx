import { cleanup, mount, tick } from "@rezejs/testing-library";
import { Show, signal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createLabelableId } from "./createLabelableId";
import { useLabelableContext } from "./LabelableContext";
import { LabelableProvider } from "./LabelableProvider";

afterEach(cleanup);

function Label() {
  const { controlId } = useLabelableContext();
  return (
    <label data-testid="label" for={controlId() ?? undefined}>
      Label
    </label>
  );
}

function Control(props: { id?: string }) {
  const id = createLabelableId({ id: () => props.id });
  return <input data-testid="control" id={id()} />;
}

function labelFor(root: ParentNode) {
  return root.querySelector('[data-testid="label"]')?.getAttribute("for");
}

describe("LabelableProvider control registration", () => {
  it("resets the label association when the last control unregisters", () => {
    function Test() {
      let show = signal(false);
      return (
        <LabelableProvider>
          <Label />
          <Show when={show}>{<Control id="custom" />}</Show>
          <button onClick={() => (show = !show)}>Toggle</button>
        </LabelableProvider>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    const fallback = labelFor(el);
    expect(fallback).toBeTruthy();

    (el.querySelector("button") as HTMLButtonElement).click();
    tick();
    expect(labelFor(el)).toBe("custom");
    expect((el.querySelector('[data-testid="control"]') as HTMLInputElement).id).toBe("custom");

    (el.querySelector("button") as HTMLButtonElement).click();
    tick();
    expect(labelFor(el)).toBe(fallback);
  });

  it("falls over to the remaining control when the selected one unmounts", () => {
    function Test() {
      let showFirst = signal(true);
      let showSecond = signal(true);
      return (
        <LabelableProvider>
          <Label />
          <Show when={showFirst}>{<Control id="a" />}</Show>
          <Show when={showSecond}>{<Control id="b" />}</Show>
          <button data-testid="first" onClick={() => (showFirst = false)}>
            Hide first
          </button>
          <button data-testid="second" onClick={() => (showSecond = false)}>
            Hide second
          </button>
        </LabelableProvider>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    expect(labelFor(el)).toBe("a");

    (el.querySelector('[data-testid="first"]') as HTMLButtonElement).click();
    tick();
    expect(labelFor(el)).toBe("b");

    (el.querySelector('[data-testid="second"]') as HTMLButtonElement).click();
    tick();
    expect(labelFor(el)).not.toBe("b");
  });

  it("pairs an id-less replacement after an explicit control unmounts", () => {
    function Test() {
      let explicit = signal(true);
      return (
        <LabelableProvider>
          <Label />
          <Show when={explicit} fallback={<Control />}>
            {<Control id="custom" />}
          </Show>
          <button onClick={() => (explicit = false)}>Swap</button>
        </LabelableProvider>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    expect(labelFor(el)).toBe("custom");

    (el.querySelector("button") as HTMLButtonElement).click();
    tick();

    const control = el.querySelector('[data-testid="control"]') as HTMLInputElement;
    expect(control?.id).toBeTruthy();
    expect(control?.id).not.toBe("custom");
    expect(labelFor(el)).toBe(control?.id);
  });
});

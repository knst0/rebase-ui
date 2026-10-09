import { render } from "@solidjs/testing-library";
import { createSignal, flush, Show } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { createLabelableId } from "./createLabelableId";
import { useLabelableContext } from "./LabelableContext";
import { LabelableProvider } from "./LabelableProvider";

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

function labelFor(container: HTMLElement) {
  return container.querySelector('[data-testid="label"]')?.getAttribute("for");
}

describe("LabelableProvider control registration", () => {
  it("resets the label association when the last control unregisters", () => {
    const [show, setShow] = createSignal(false);
    const { container } = render(() => (
      <LabelableProvider>
        <Label />
        <Show when={show()}>{<Control id="custom" />}</Show>
      </LabelableProvider>
    ));
    flush();

    const fallback = labelFor(container);
    expect(fallback).toBeTruthy();

    setShow(true);
    flush();
    expect(labelFor(container)).toBe("custom");
    expect(container.querySelector('[data-testid="control"]')?.id).toBe("custom");

    setShow(false);
    flush();
    expect(labelFor(container)).toBe(fallback);
  });

  it("falls over to the remaining control when the selected one unmounts", () => {
    const [showFirst, setShowFirst] = createSignal(true);
    const [showSecond, setShowSecond] = createSignal(true);
    const { container } = render(() => (
      <LabelableProvider>
        <Label />
        <Show when={showFirst()}>{<Control id="a" />}</Show>
        <Show when={showSecond()}>{<Control id="b" />}</Show>
      </LabelableProvider>
    ));
    flush();

    expect(labelFor(container)).toBe("a");

    setShowFirst(false);
    flush();
    expect(labelFor(container)).toBe("b");

    setShowSecond(false);
    flush();
    expect(labelFor(container)).not.toBe("b");
  });

  it("pairs an id-less replacement after an explicit control unmounts", () => {
    const [explicit, setExplicit] = createSignal(true);
    const { container } = render(() => (
      <LabelableProvider>
        <Label />
        <Show when={explicit()} fallback={<Control />}>
          {<Control id="custom" />}
        </Show>
      </LabelableProvider>
    ));
    flush();

    expect(labelFor(container)).toBe("custom");

    setExplicit(false);
    flush();

    const control = container.querySelector('[data-testid="control"]');
    expect(control?.id).toBeTruthy();
    expect(control?.id).not.toBe("custom");
    expect(labelFor(container)).toBe(control?.id);
  });
});

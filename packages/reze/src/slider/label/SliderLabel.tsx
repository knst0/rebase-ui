import { isHTMLElement } from "@floating-ui/utils/dom";
import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createLabel, focusElementWithVisible } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { getSliderStateSnapshot, type SliderRoot } from "../root/SliderRoot";
import { useSliderRootContext } from "../root/SliderRootContext";

/**
 * An accessible label that is automatically associated with the slider thumbs.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Slider](https://rebase-ui.knst.dev/components/slider)
 */
export function SliderLabel<T extends JSX.ElementType = "div">(props: SliderLabel.Props<T>) {
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  const rest = omitProps(props, "as", "id", "onClick", "onPointerDown", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { state, setLabelId, controlElement, rootLabelId } = useSliderRootContext();

  function focusControl(event: MouseEvent, controlId: string | null | undefined) {
    if (controlId) {
      const root = (event.currentTarget as Element).getRootNode() as Document | ShadowRoot;
      const control = root.getElementById(controlId);
      if (isHTMLElement(control)) {
        focusElementWithVisible(control);
        return;
      }
    }

    const fallbackInputs = controlElement()?.querySelectorAll('input[type="range"]');
    const fallbackInput = fallbackInputs?.length === 1 ? fallbackInputs[0] : null;
    if (isHTMLElement(fallbackInput)) {
      focusElementWithVisible(fallbackInput);
    }
  }

  const labelProps = createLabel({
    id: rootLabelId,
    setLabelId,
    focusControl,
  });

  function handleClick(event: MouseEvent): void {
    makeEventPreventable(event as RebaseUIEvent<MouseEvent>);
    (labelProps.onClick as ((event: MouseEvent) => void) | undefined)?.(event);
    if (!(event as RebaseUIEvent<MouseEvent>).rebaseUIHandlerPrevented) {
      props.onClick?.(event as RebaseUIEvent<MouseEvent>);
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    makeEventPreventable(event as RebaseUIEvent<PointerEvent>);
    (labelProps.onPointerDown as ((event: PointerEvent) => void) | undefined)?.(event);
    if (!(event as RebaseUIEvent<PointerEvent>).rebaseUIHandlerPrevented) {
      props.onPointerDown?.(event as RebaseUIEvent<PointerEvent>);
    }
  }

  function snapshot(): SliderLabelState {
    return getSliderStateSnapshot(state);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        id={labelProps.id}
        data-dragging={state.dragging() ? "" : undefined}
        data-orientation={state.orientation()}
        data-disabled={state.disabled() ? "" : undefined}
        data-valid={state.valid() === true ? "" : undefined}
        data-invalid={state.valid() === false ? "" : undefined}
        data-touched={state.touched() ? "" : undefined}
        data-dirty={state.dirty() ? "" : undefined}
        data-filled={state.filled() ? "" : undefined}
        data-focused={state.focused() ? "" : undefined}
        data-validating={state.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={labelProps.id}
      data-dragging={state.dragging() ? "" : undefined}
      data-orientation={state.orientation()}
      data-disabled={state.disabled() ? "" : undefined}
      data-valid={state.valid() === true ? "" : undefined}
      data-invalid={state.valid() === false ? "" : undefined}
      data-touched={state.touched() ? "" : undefined}
      data-dirty={state.dirty() ? "" : undefined}
      data-filled={state.filled() ? "" : undefined}
      data-focused={state.focused() ? "" : undefined}
      data-validating={state.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export type SliderLabelState = SliderRoot.State;

export type SliderLabelProps<T extends JSX.ElementType = "div"> = ButtonEventHandlers & Omit<RebaseUIComponentProps<T, SliderLabel.State>, "id">;

export namespace SliderLabel {
  export type State = SliderLabelState;
  export type Props<T extends JSX.ElementType = "div"> = SliderLabelProps<T>;
}

import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { getSliderStateSnapshot, type SliderRootState } from "../root/SliderRoot";
import { useSliderRootContext } from "../root/SliderRootContext";

/**
 * Contains the slider indicator and represents the entire range of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Slider](https://rebase-ui.knst.dev/components/slider)
 */
export function SliderTrack<T extends JSX.ElementType = "div">(props: SliderTrack.Props<T>) {
  const rest = omitProps(props, "as", "style", "class", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { state } = useSliderRootContext();

  function snapshot(): SliderTrackState {
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
        style={mergeStyleValue({ position: "relative" }, resolveStyleValue(props.style, snapshot()))}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
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
      style={mergeStyleValue({ position: "relative" }, resolveStyleValue(props.style, snapshot()))}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface SliderTrackState extends SliderRootState {}

export type SliderTrackProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, SliderTrackState>;

export namespace SliderTrack {
  export type State = SliderTrackState;
  export type Props<T extends JSX.ElementType = "div"> = SliderTrackProps<T>;
}

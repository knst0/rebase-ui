import { valueToPercent } from "@rebase-ui/core/valueToPercent";
import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { getSliderStateSnapshot, type SliderRootState } from "../root/SliderRoot";
import { useSliderRootContext } from "../root/SliderRootContext";
import { createIsHydrating } from "../utils/createIsHydrating";

function getIndicatorStyles(
  vertical: boolean,
  range: boolean,
  inset: boolean,
  start: number | undefined,
  end: number | undefined,
  forceHidden: boolean,
): JSX.CSSProperties {
  const styles: JSX.CSSProperties & Record<string, unknown> = {
    visibility: forceHidden || (inset && (start === undefined || (range && end === undefined))) ? ("hidden" as const) : undefined,
    position: vertical ? "absolute" : "relative",
    [vertical ? "width" : "height"]: "inherit",
  };

  let startValue: string = `${start ?? 0}%`;
  let sizeValue: string = `${(end ?? 0) - (start ?? 0)}%`;

  if (inset) {
    styles["--start-position"] = startValue;
    startValue = "var(--start-position)";

    if (range) {
      styles["--relative-size"] = sizeValue;
      sizeValue = "var(--relative-size)";
    }
  }

  // NB: kebab-case is required. Object styles are applied via `CSSStyleDeclaration.setProperty`,
  // which silently ignores camelCase names such as `insetInlineStart`.
  styles[vertical ? "bottom" : "inset-inline-start"] = range ? startValue : 0;
  styles[vertical ? "height" : "width"] = range ? sizeValue : startValue;

  return styles;
}

/**
 * Visualizes the current value of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Slider](https://rebase-ui.knst.dev/components/slider)
 */
export function SliderIndicator<T extends JSX.ElementType = "div">(props: SliderIndicator.Props<T>) {
  const rest = omitProps(props, "as", "style", "class", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { indicatorPosition, inset, max, min, orientation, renderBeforeHydration, state, values } = useSliderRootContext();

  const isHydrating = createIsHydrating();

  const vertical = () => orientation() === "vertical";
  const range = () => values().length > 1;

  function indicatorStyle(): JSX.CSSProperties {
    return getIndicatorStyles(
      vertical(),
      range(),
      inset(),
      inset() ? indicatorPosition()[0] : valueToPercent(values()[0], min(), max()),
      inset() ? indicatorPosition()[1] : valueToPercent(values()[values().length - 1], min(), max()),
      inset() && renderBeforeHydration() && isHydrating(),
    );
  }

  function snapshot(): SliderIndicatorState {
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
        data-base-ui-slider-indicator={renderBeforeHydration() ? "" : undefined}
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
        style={mergeStyleValue(indicatorStyle() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-base-ui-slider-indicator={renderBeforeHydration() ? "" : undefined}
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
      style={mergeStyleValue(indicatorStyle() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface SliderIndicatorState extends SliderRootState {}

export type SliderIndicatorProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, SliderIndicatorState>;

export namespace SliderIndicator {
  export type State = SliderIndicatorState;
  export type Props<T extends JSX.ElementType = "div"> = SliderIndicatorProps<T>;
}

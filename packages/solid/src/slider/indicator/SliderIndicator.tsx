import type { JSX, ValidComponent } from "@solidjs/web";
import { createMemo, untrack } from "solid-js";

import { valueToPercent } from "../../internals/utils/valueToPercent";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSliderRootContext } from "../root/SliderRootContext";
import type { SliderRootState } from "../root/SliderRoot";
import { sliderStateAttributesMapping } from "../root/stateAttributesMapping";
import { createIsHydrating } from "../utils/createIsHydrating";
import { mergeStyles } from "../utils/mergeStyles";

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

  // NB: kebab-case is required. Solid applies object styles via `CSSStyleDeclaration.setProperty`,
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
export function SliderIndicator<T extends ValidComponent = "div">(props: SliderIndicator.Props<T>) {
  const [local, elementProps] = split(props as SliderIndicator.Props, { default: defaultProps }, ["as", "style"]);

  const as = untrack(() => local.as);

  const { indicatorPosition, inset, max, min, orientation, renderBeforeHydration, state, values } = useSliderRootContext();

  const isHydrating = createIsHydrating();

  const vertical = () => orientation() === "vertical";
  const range = () => values().length > 1;

  const style = createMemo(() =>
    getIndicatorStyles(
      vertical(),
      range(),
      inset(),
      inset() ? indicatorPosition()[0] : valueToPercent(values()[0], min(), max()),
      inset() ? indicatorPosition()[1] : valueToPercent(values()[values().length - 1], min(), max()),
      inset() && renderBeforeHydration() && isHydrating(),
    ),
  );

  const indicatorMarkerProps: Record<string, any> = {
    "data-base-ui-slider-indicator": renderBeforeHydration() ? "" : undefined,
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        indicatorMarkerProps,
        elementProps,
        () => ({
          style: mergeStyles(state, style(), local.style),
        }),
      ]}
      stateAttributesMapping={sliderStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SliderIndicator.Props>);

export interface SliderIndicatorState extends SliderRootState {}

export type SliderIndicatorProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, SliderIndicatorState>;

export namespace SliderIndicator {
  export type State = SliderIndicatorState;
  export type Props<T extends ValidComponent = "div"> = SliderIndicatorProps<T>;
}

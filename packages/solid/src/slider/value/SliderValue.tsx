import type { JSX, ValidComponent } from "@solidjs/web";
import { createMemo, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { SliderRootState } from "../root/SliderRoot";
import { useSliderRootContext } from "../root/SliderRootContext";
import { sliderStateAttributesMapping } from "../root/stateAttributesMapping";
import { formatNumber } from "../utils/formatNumber";

/**
 * Displays the current value of the slider as text.
 * Renders an `<output>` element.
 *
 * Documentation: [Rebase UI Slider](https://rebase-ui.knst.dev/components/slider)
 */
export function SliderValue<T extends ValidComponent = "output">(props: SliderValue.Props<T>) {
  const [local, elementProps] = split(props as SliderValue.Props, { default: defaultProps }, ["as", "aria-live", "children"]);

  const as = untrack(() => local.as);

  const { thumbMap, state, values, format, locale } = useSliderRootContext();

  const outputFor = () =>
    Array.from(thumbMap().values(), ({ inputId }) => inputId)
      .join(" ")
      .trim() || undefined;

  const formattedValues = createMemo(() => values().map((v) => formatNumber(v, locale(), format())));

  const defaultDisplayValue = () => formattedValues().join(" – ");

  const displayValue = () => {
    const children = local.children;
    if (typeof children === "function") {
      return children(formattedValues(), values());
    }
    return children ?? defaultDisplayValue();
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        {
          // off by default because it will keep announcing when the slider is being dragged
          // and also when the value is changing (but not yet committed)
          get "aria-live"() {
            return local["aria-live"];
          },
          get children() {
            return displayValue();
          },
          get for() {
            return outputFor();
          },
        },
        elementProps,
      ]}
      stateAttributesMapping={sliderStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "output",
  "aria-live": "off",
} satisfies Partial<SliderValue.Props>);

export interface SliderValueState extends SliderRootState {}

export type SliderValueProps<T extends ValidComponent = "output"> = Omit<RebaseUIComponentProps<T, SliderValueState>, "children"> & {
  children?: null | ((formattedValues: readonly string[], values: readonly number[]) => JSX.Element) | undefined;
};

export namespace SliderValue {
  export type State = SliderValueState;
  export type Props<T extends ValidComponent = "output"> = SliderValueProps<T>;
}

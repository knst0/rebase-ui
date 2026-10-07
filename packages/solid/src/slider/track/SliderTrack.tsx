import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { SliderRootState } from "../root/SliderRoot";
import { useSliderRootContext } from "../root/SliderRootContext";
import { sliderStateAttributesMapping } from "../root/stateAttributesMapping";
import { mergeStyles } from "../utils/mergeStyles";

/**
 * Contains the slider indicator and represents the entire range of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Slider](https://rebase-ui.knst.dev/components/slider)
 */
export function SliderTrack<T extends ValidComponent = "div">(props: SliderTrack.Props<T>) {
  const [local, elementProps] = split(props as SliderTrack.Props, { default: defaultProps }, ["as", "style"]);

  const as = untrack(() => local.as);

  const { state } = useSliderRootContext();

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        elementProps,
        () => ({
          style: mergeStyles(state, { position: "relative" }, local.style),
        }),
      ]}
      stateAttributesMapping={sliderStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SliderTrack.Props>);

export interface SliderTrackState extends SliderRootState {}

export type SliderTrackProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, SliderTrackState>;

export namespace SliderTrack {
  export type State = SliderTrackState;
  export type Props<T extends ValidComponent = "div"> = SliderTrackProps<T>;
}

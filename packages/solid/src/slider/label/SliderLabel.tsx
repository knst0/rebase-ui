import { isHTMLElement } from "@floating-ui/utils/dom";
import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { createLabel, focusElementWithVisible } from "../../internals/labelable-provider";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import { useSliderRootContext } from "../root/SliderRootContext";
import type { SliderRoot } from "../root/SliderRoot";
import { sliderStateAttributesMapping } from "../root/stateAttributesMapping";

/**
 * An accessible label that is automatically associated with the slider thumbs.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Slider](https://rebase-ui.knst.dev/components/slider)
 */
export function SliderLabel<T extends ValidComponent = "div">(props: SliderLabel.Props<T>) {
  const [local, elementProps] = split(props as SliderLabel.Props, { default: defaultProps }, ["as"]);
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  if ("id" in elementProps) {
    delete (elementProps as Record<string, any>).id;
  }

  const as = untrack(() => local.as);

  const { state, setLabelId, controlElement, rootLabelId } = useSliderRootContext();

  function focusControl(event: MouseEvent, controlId: string | null | undefined) {
    if (controlId) {
      const control = ownerDocument(event.currentTarget as Element).getElementById(controlId);
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

  return (
    <RenderElement
      as={as}
      state={state}
      props={[labelProps, elementProps]}
      stateAttributesMapping={sliderStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SliderLabel.Props>);

export type SliderLabelState = SliderRoot.State;

export type SliderLabelProps<T extends ValidComponent = "div"> = Omit<RebaseUIComponentProps<T, SliderLabel.State>, "id">;

export namespace SliderLabel {
  export type State = SliderLabelState;
  export type Props<T extends ValidComponent = "div"> = SliderLabelProps<T>;
}

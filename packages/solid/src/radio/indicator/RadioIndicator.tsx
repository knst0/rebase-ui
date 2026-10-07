import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { createTransitionStatus, type TransitionStatus, transitionStatusMapping } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { RadioRootState } from "../root/RadioRoot";
import { useRadioRootContext } from "../root/RadioRootContext";
import { stateAttributesMapping } from "../utils/stateAttributesMapping";

/**
 * Indicates whether the radio button is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Radio](https://rebase-ui.knst.dev/components/radio)
 */
export function RadioIndicator<T extends ValidComponent = "span">(props: RadioIndicator.Props<T>) {
  const [local, elementProps] = split(props as RadioIndicator.Props, { default: defaultProps }, ["as", "keepMounted"]);

  const as = untrack(() => local.as);

  const rootState = useRadioRootContext();

  const rendered = () => rootState.checked();

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(rendered);

  let indicatorElement: HTMLElement | null = null;

  const state: RadioIndicatorState = { ...rootState, transitionStatus };

  runOnOpenChangeComplete({
    open: rendered,
    ref: () => indicatorElement,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  const indicatorStateAttributesMapping = {
    ...stateAttributesMapping,
    ...transitionStatusMapping,
  } as StateAttributesMapping<RadioIndicatorState>;

  const shouldRender = () => local.keepMounted || mounted();

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      stateAttributesMapping={indicatorStateAttributesMapping}
      props={[elementProps, { ref: (element: HTMLElement) => (indicatorElement = element) }]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "span",
  keepMounted: false,
} satisfies Partial<RadioIndicator.Props>);

export interface RadioIndicatorState extends RadioRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface RadioIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the radio button is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type RadioIndicatorProps<T extends ValidComponent = "span"> = RadioIndicatorOwnProps &
  RebaseUIComponentProps<T, RadioIndicatorState>;

export namespace RadioIndicator {
  export type State = RadioIndicatorState;
  export type Props<T extends ValidComponent = "span"> = RadioIndicatorProps<T>;
  export type OwnProps = RadioIndicatorOwnProps;
}

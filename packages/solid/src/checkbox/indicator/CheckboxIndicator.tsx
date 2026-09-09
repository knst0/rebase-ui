import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { createTransitionStatus, type TransitionStatus, transitionStatusMapping } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { CheckboxRootState } from "../root/CheckboxRoot";
import { useCheckboxRootContext } from "../root/CheckboxRootContext";
import { getCheckboxStateAttributesMapping } from "../utils/getCheckboxStateAttributesMapping";

/**
 * Indicates whether the checkbox is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Checkbox](https://rebase-ui.knst.dev/components/checkbox)
 */
export function CheckboxIndicator<T extends ValidComponent = "span">(props: CheckboxIndicator.Props<T>) {
  const [local, elementProps] = split(props as CheckboxIndicator.Props, { default: defaultProps }, ["as", "keepMounted"]);

  const as = untrack(() => local.as);

  const rootState = useCheckboxRootContext();

  const rendered = () => rootState.checked() || rootState.indeterminate();

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(rendered);

  let indicatorElement: HTMLElement | null = null;

  const state: CheckboxIndicatorState = { ...rootState, transitionStatus };

  runOnOpenChangeComplete({
    open: rendered,
    ref: () => indicatorElement,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  const stateAttributesMapping = {
    ...getCheckboxStateAttributesMapping(rootState),
    ...transitionStatusMapping,
  } as StateAttributesMapping<CheckboxIndicatorState>;

  const shouldRender = () => local.keepMounted || mounted();

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      stateAttributesMapping={stateAttributesMapping}
      props={[elementProps, { ref: (element: HTMLElement) => (indicatorElement = element) }]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "span",
  keepMounted: false,
} satisfies Partial<CheckboxIndicator.Props>);

export interface CheckboxIndicatorState extends CheckboxRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface CheckboxIndicatorOwnProps {
  /**
   * Whether to keep the element in the DOM when the checkbox is not ticked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type CheckboxIndicatorProps<T extends ValidComponent = "span"> = CheckboxIndicatorOwnProps &
  RebaseUIComponentProps<T, CheckboxIndicatorState>;

export namespace CheckboxIndicator {
  export type State = CheckboxIndicatorState;
  export type Props<T extends ValidComponent = "span"> = CheckboxIndicatorProps<T>;
  export type OwnProps = CheckboxIndicatorOwnProps;
}

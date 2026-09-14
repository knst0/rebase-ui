import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import {
  createTransitionStatus,
  type TransitionStatus,
  transitionStatusMapping,
} from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxItemContext } from "../item/ComboboxItemContext";

/**
 * Indicates whether the item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxItemIndicator<T extends ValidComponent = "span">(
  props: ComboboxItemIndicator.Props<T>,
) {
  const [local, elementProps] = split(
    props as ComboboxItemIndicator.Props,
    { default: defaultProps },
    ["as", "keepMounted"],
  );

  const as = untrack(() => local.as);

  const item = useComboboxItemContext();

  const rendered = () => item.selected();

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(rendered);

  let indicatorElement: HTMLElement | null = null;

  runOnOpenChangeComplete({
    open: rendered,
    ref: () => indicatorElement,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  const state: ComboboxItemIndicatorState = {
    selected: rendered,
    transitionStatus,
  };

  const stateAttributesMapping = {
    ...transitionStatusMapping,
  } as StateAttributesMapping<ComboboxItemIndicatorState>;

  const shouldRender = () => local.keepMounted || mounted();

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      stateAttributesMapping={stateAttributesMapping}
      props={[
        {
          "aria-hidden": "true" as const,
          children: "✔️",
        },
        elementProps,
        {
          ref: (element: HTMLElement | null) => {
            indicatorElement = element;
          },
        },
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "span",
  keepMounted: false,
} satisfies Partial<ComboboxItemIndicator.Props>);

export interface ComboboxItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface ComboboxItemIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type ComboboxItemIndicatorProps<T extends ValidComponent = "span"> =
  ComboboxItemIndicatorOwnProps & RebaseUIComponentProps<T, ComboboxItemIndicatorState>;

export namespace ComboboxItemIndicator {
  export type State = ComboboxItemIndicatorState;
  export type Props<T extends ValidComponent = "span"> = ComboboxItemIndicatorProps<T>;
  export type OwnProps = ComboboxItemIndicatorOwnProps;
}

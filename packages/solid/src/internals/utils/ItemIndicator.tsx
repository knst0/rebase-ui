import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement } from "../render-element";
import { runOnOpenChangeComplete } from "../runOnOpenChangeComplete";
import { split } from "../split";
import type { StateAttributesMapping } from "../stateToAttributes";
import { createTransitionStatus, type TransitionStatus, transitionStatusMapping } from "../transition-status";
import type { RebaseUIComponentProps } from "../types";

/**
 * Shared item-selected indicator for Combobox and Select. Ports upstream
 * `utils/ItemIndicator`.
 *
 * The public wrappers mount this component only when selected or kept mounted,
 * avoiding the transition costs for unselected items. Selection arrives as an
 * accessor (rather than upstream's memo-observed boolean prop) so the
 * kept-mounted element stays reactive when selection changes.
 */
export function ItemIndicator<T extends ValidComponent = "span">(props: ItemIndicator.Props<T>) {
  const [local, elementProps] = split(props as ItemIndicator.Props, { default: defaultProps }, ["as", "keepMounted", "selected"]);

  const as = untrack(() => local.as);
  const selected = local.selected as Accessor<boolean>;

  const rendered = () => selected();

  const { transitionStatus, setMounted } = createTransitionStatus(rendered);

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

  const state: ItemIndicatorState = {
    selected: rendered,
    transitionStatus,
  };

  const stateAttributesMapping = {
    ...transitionStatusMapping,
  } as StateAttributesMapping<ItemIndicatorState>;

  return (
    <RenderElement
      as={as}
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
} satisfies Partial<ItemIndicator.Props>);

export interface ItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface ItemIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Whether the item is selected. Passed as an accessor so memoization observes changes.
   */
  selected: Accessor<boolean>;
}

export type ItemIndicatorProps<T extends ValidComponent = "span"> = ItemIndicatorOwnProps & RebaseUIComponentProps<T, ItemIndicatorState>;

export namespace ItemIndicator {
  export type State = ItemIndicatorState;
  export type Props<T extends ValidComponent = "span"> = ItemIndicatorProps<T>;
  export type OwnProps = ItemIndicatorOwnProps;
}

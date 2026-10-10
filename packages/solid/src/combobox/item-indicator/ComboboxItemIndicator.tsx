import type { ValidComponent } from "@solidjs/web";
import { Show, type Accessor, untrack } from "solid-js";

import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ItemIndicator } from "../../internals/utils/ItemIndicator";
import { useComboboxItemContext } from "../item/ComboboxItemContext";

/**
 * Indicates whether the item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxItemIndicator<T extends ValidComponent = "span">(props: ComboboxItemIndicator.Props<T>) {
  const item = useComboboxItemContext();

  const keepMounted = untrack(() => (props as ComboboxItemIndicator.Props).keepMounted ?? false);

  // Mount only when selected or kept mounted, avoiding the transition costs for
  // unselected items. Pass selection as an accessor so memoization observes changes.
  const shouldRender = () => keepMounted || item.selected();

  return (
    <Show when={shouldRender()}>
      <ItemIndicator {...(props as ItemIndicator.Props<T>)} selected={item.selected} />
    </Show>
  );
}

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

export type ComboboxItemIndicatorProps<T extends ValidComponent = "span"> = ComboboxItemIndicatorOwnProps &
  RebaseUIComponentProps<T, ComboboxItemIndicatorState>;

export namespace ComboboxItemIndicator {
  export type State = ComboboxItemIndicatorState;
  export type Props<T extends ValidComponent = "span"> = ComboboxItemIndicatorProps<T>;
  export type OwnProps = ComboboxItemIndicatorOwnProps;
}

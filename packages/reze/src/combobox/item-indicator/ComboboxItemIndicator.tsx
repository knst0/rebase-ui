import { untrack, type JSX } from "reze-js";

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
export function ComboboxItemIndicator<T extends JSX.ElementType = "span">(props: ComboboxItemIndicator.Props<T>) {
  const item = useComboboxItemContext();

  const keepMounted = untrack(() => (props as ComboboxItemIndicator.Props).keepMounted ?? false);

  // Mount only when selected or kept mounted, avoiding the transition costs for
  // unselected items. Pass selection as an accessor so memoization observes changes.
  function shouldRender() {
    return keepMounted || item.selected();
  }

  return <>{shouldRender() && <ItemIndicator {...(props as ItemIndicator.Props<T>)} selected={item.selected} />}</>;
}

export interface ComboboxItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface ComboboxItemIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type ComboboxItemIndicatorProps<T extends JSX.ElementType = "span"> = ComboboxItemIndicatorOwnProps &
  RebaseUIComponentProps<T, ComboboxItemIndicatorState>;

export namespace ComboboxItemIndicator {
  export type State = ComboboxItemIndicatorState;
  export type Props<T extends JSX.ElementType = "span"> = ComboboxItemIndicatorProps<T>;
  export type OwnProps = ComboboxItemIndicatorOwnProps;
}

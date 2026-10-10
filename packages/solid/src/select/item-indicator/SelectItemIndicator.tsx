import type { ValidComponent } from "@solidjs/web";
import { Show, type Accessor, untrack } from "solid-js";

import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ItemIndicator } from "../../internals/utils/ItemIndicator";
import { useSelectItemContext } from "../item/SelectItemContext";

/**
 * Indicates whether the select item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemIndicator<T extends ValidComponent = "span">(props: SelectItemIndicator.Props<T>) {
  const item = useSelectItemContext();

  const keepMounted = untrack(() => (props as SelectItemIndicator.Props).keepMounted ?? false);

  // Mount only when selected or kept mounted, avoiding the transition costs for
  // unselected items. Pass selection as an accessor so memoization observes changes.
  const shouldRender = () => keepMounted || item.selected();

  return (
    <Show when={shouldRender()}>
      <ItemIndicator {...(props as ItemIndicator.Props<T>)} selected={item.selected} />
    </Show>
  );
}

export interface SelectItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface SelectItemIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type SelectItemIndicatorProps<T extends ValidComponent = "span"> = SelectItemIndicatorOwnProps &
  RebaseUIComponentProps<T, SelectItemIndicatorState>;

export namespace SelectItemIndicator {
  export type State = SelectItemIndicatorState;
  export type Props<T extends ValidComponent = "span"> = SelectItemIndicatorProps<T>;
  export type OwnProps = SelectItemIndicatorOwnProps;
}

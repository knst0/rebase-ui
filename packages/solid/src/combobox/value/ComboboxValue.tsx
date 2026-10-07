import type { JSX } from "@solidjs/web";
import { createMemo, untrack, type Accessor } from "solid-js";

import { resolveSelectedLabel, type SelectItemsInput } from "../../select/utils/resolveValueLabel";
import { useComboboxRootContext } from "../root/ComboboxRootContext";

function resolveMultipleLabels(
  value: ReadonlyArray<unknown>,
  items: SelectItemsInput,
  itemToStringLabel: ((item: unknown) => string) | undefined,
): string {
  return value.map((item) => String(resolveSelectedLabel(item, items, itemToStringLabel) ?? "")).join(", ");
}

/**
 * The current value of the combobox.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxValue(props: ComboboxValue.Props): JSX.Element {
  const store = useComboboxRootContext();
  const childrenProp = untrack(() => props.children);
  const placeholder = untrack(() => props.placeholder);

  if (typeof childrenProp === "function") {
    // The render function runs once: re-invoking it on every selection change
    // would recreate the rendered subtree (chips, the input), losing DOM state
    // and focus. The selection is handed over as an accessor so reads inside
    // the returned JSX stay reactive.
    const selectedValue: Accessor<unknown> = () => store.select("selectedValue");
    return untrack(() => (childrenProp as (value: Accessor<unknown>) => JSX.Element)(selectedValue));
  }

  if (childrenProp != null) {
    return childrenProp as JSX.Element;
  }

  const resolved = createMemo(() => {
    const selectedValue: unknown = store.select("selectedValue");
    const multiple = (store.select("selectionMode") as string) === "multiple";
    const hasSelectedValue = store.select("hasSelectedValue") as boolean;

    if (!hasSelectedValue && placeholder != null) {
      const hasNullLabel = store.select("hasNullItemLabel", true) as boolean;
      if (!hasNullLabel) {
        return placeholder;
      }
    }

    const items = store.select("items") as SelectItemsInput;
    const itemToStringLabel = store.select("itemToStringLabel") as ((item: unknown) => string) | undefined;

    if (multiple && Array.isArray(selectedValue)) {
      return resolveMultipleLabels(selectedValue, items, itemToStringLabel);
    }

    return resolveSelectedLabel(selectedValue, items, itemToStringLabel);
  });

  return <>{resolved()}</>;
}

export interface ComboboxValueState {}

export interface ComboboxValueProps {
  /**
   * Accepts a function that returns a `JSX.Element` to format the selected value.
   * The value arrives as an accessor: read it inside the returned JSX so updates
   * stay reactive without recreating the subtree.
   * Treat the value as read-only: in `multiple` mode it may be a shared frozen array
   * when nothing is selected.
   */
  children?: JSX.Element | ((selectedValue: Accessor<any>) => JSX.Element);
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by `children` if specified, or by a null item's label in `items`.
   */
  placeholder?: JSX.Element;
}

export namespace ComboboxValue {
  export type State = ComboboxValueState;
  export type Props = ComboboxValueProps;
}

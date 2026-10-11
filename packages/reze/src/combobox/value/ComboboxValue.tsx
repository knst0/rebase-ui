import type { JSX } from "reze-js";

import { createScopedRender } from "../../internals/renderProps";
import { useComboboxRootContext } from "../root/ComboboxRootContext";
import { resolveSelectedLabel, type SelectItemsInput } from "../../select/utils/resolveValueLabel";

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
  const childrenProp = props.children;
  const placeholder = props.placeholder;

  if (typeof childrenProp === "function") {
    // The render function runs once: re-invoking it on every selection change
    // would recreate the rendered subtree (chips, the input), losing DOM state
    // and focus. The selection is handed over as an accessor so reads inside
    // the returned JSX stay reactive.
    const selectedValue: () => unknown = () => store.select("selectedValue");
    const result = (childrenProp as (value: () => unknown) => JSX.Element)(selectedValue);
    return createScopedRender().bindResult(result, selectedValue);
  }

  if (childrenProp != null) {
    return childrenProp as JSX.Element;
  }

  function resolved(): JSX.Element {
    const selectedValue: unknown = store.select("selectedValue");
    const multiple = (store.select("selectionMode") as string) === "multiple";
    const hasSelectedValue = store.select("hasSelectedValue") as boolean;

    if (!hasSelectedValue && placeholder != null) {
      const hasNullLabel = store.select("hasNullItemLabel", true) as boolean;
      if (!hasNullLabel) {
        return placeholder as JSX.Element;
      }
    }

    const items = store.select("items") as SelectItemsInput;
    const itemToStringLabel = store.select("itemToStringLabel") as ((item: unknown) => string) | undefined;

    if (multiple && Array.isArray(selectedValue)) {
      return resolveMultipleLabels(selectedValue, items, itemToStringLabel);
    }

    return resolveSelectedLabel(selectedValue, items, itemToStringLabel);
  }

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
  children?: JSX.Element | ((selectedValue: () => any) => JSX.Element);
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

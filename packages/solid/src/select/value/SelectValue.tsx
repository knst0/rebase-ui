import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";
import { resolveSelectedLabel, type SelectItemsInput } from "../utils/resolveValueLabel";

const nullMapping = { keys: [], map: () => null };

const selectValueStateMapping: StateAttributesMapping<SelectValueState> = {
  value: nullMapping,
};

/**
 * A text label of the currently selected item.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectValue<T extends ValidComponent = "span">(props: SelectValue.Props<T>) {
  const [local, elementProps] = split(props as SelectValue.Props, { default: defaultProps }, ["as", "children", "placeholder"]);

  const as = untrack(() => local.as);

  const store = useSelectRootContext();

  const state: SelectValueState = {
    get value() {
      return store.select("value");
    },
    get placeholder() {
      return !store.select("hasSelectedValue");
    },
  };

  function resolveChildren(): JSX.Element {
    const value = store.select("value");
    const childrenProp = untrack(() => local.children) as JSX.Element | ((value: unknown) => JSX.Element) | undefined;

    if (typeof childrenProp === "function") {
      return (childrenProp as (value: unknown) => JSX.Element)(value);
    }

    if (childrenProp != null) {
      return childrenProp as JSX.Element;
    }

    const placeholder = untrack(() => local.placeholder) as JSX.Element | undefined;
    const hasSelectedValue = store.select("hasSelectedValue") as boolean;
    const shouldCheckNullItemLabel = !hasSelectedValue && placeholder != null;
    const hasNullLabel = store.select("hasNullItemLabel", shouldCheckNullItemLabel) as boolean;

    if (shouldCheckNullItemLabel && !hasNullLabel) {
      return placeholder as JSX.Element;
    }

    const items = store.select("items") as SelectItemsInput;
    const itemToStringLabel = store.select("itemToStringLabel") as ((item: unknown) => string) | undefined;

    if (Array.isArray(value)) {
      return resolveMultipleLabels(value, items, itemToStringLabel);
    }

    return resolveSelectedLabel(value, items, itemToStringLabel);
  }

  const childrenProp = {
    get children() {
      return resolveChildren();
    },
  };

  const refProps = (externalProps: Record<string, unknown>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref as ((element: HTMLElement) => void) | undefined, (element) => {
      store.context.valueRef.current = element;
    }),
  });

  return (
    <RenderElement as={as} state={state} props={[childrenProp, elementProps, refProps]} stateAttributesMapping={selectValueStateMapping} />
  );
}

function resolveMultipleLabels(
  value: ReadonlyArray<unknown>,
  items: SelectItemsInput,
  itemToStringLabel: ((item: unknown) => string) | undefined,
): string {
  return value.map((item) => String(resolveSelectedLabel(item, items, itemToStringLabel) ?? "")).join(", ");
}

const defaultProps = Object.freeze({
  as: "span",
} satisfies Partial<SelectValue.Props>);

export interface SelectValueState {
  /**
   * The value of the currently selected item.
   */
  value: unknown;
  /**
   * Whether the placeholder is being displayed.
   */
  placeholder: boolean;
}

export interface SelectValueOwnProps {
  /**
   * Accepts a function that returns a node to format the selected value.
   * Treat the value as read-only: in `multiple` mode it may be a shared frozen array
   * when nothing is selected.
   * @example
   * ```tsx
   * <Select.Value>
   *   {(value: string | null) => (value ? labels[value] : 'No value')}
   * </Select.Value>
   * ```
   */
  children?: JSX.Element | ((value: never) => JSX.Element);
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by `children` if specified, or by a null item's label in `items`.
   */
  placeholder?: JSX.Element;
}

export type SelectValueProps<T extends ValidComponent = "span"> = SelectValueOwnProps &
  Omit<RebaseUIComponentProps<T, SelectValueState>, "children">;

export namespace SelectValue {
  export type State = SelectValueState;
  export type Props<T extends ValidComponent = "span"> = SelectValueProps<T>;
  export type OwnProps = SelectValueOwnProps;
}

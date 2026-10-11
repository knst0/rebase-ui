import { dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { createScopedRender, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";
import { resolveSelectedLabel, type SelectItemsInput } from "../utils/resolveValueLabel";

/**
 * A text label of the currently selected item.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectValue<T extends JSX.ElementType = "span">(props: SelectValue.Props<T>) {
  const rest = omitProps(props, "as", "children", "placeholder", "class", "style", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useSelectRootContext();
  const scopedRender = createScopedRender();

  function snapshot(): SelectValueState {
    return {
      value: store.select("value"),
      placeholder: !store.select("hasSelectedValue"),
    };
  }

  function resolveChildren(): JSX.Element {
    const value = store.select("value");
    const childrenProp = untrack(() => children) as JSX.Element | ((value: unknown) => JSX.Element) | undefined;

    if (typeof childrenProp === "function") {
      // resolveChildren runs as an insert-time binding: invoke under a scoped
      // generation so parts resolve under the local providers without leaking.
      const render = childrenProp as (value: unknown) => JSX.Element;
      return scopedRender.call(() => render(value));
    }

    if (childrenProp != null) {
      return childrenProp as JSX.Element;
    }

    const placeholder = untrack(() => props.placeholder) as JSX.Element | undefined;
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

  function ref(element: HTMLElement | null): void {
    mergeRefs<HTMLElement | null>((props.ref as ((element: HTMLElement | null) => void) | undefined), (target) => {
      store.context.valueRef.current = target;
    })(element);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would drop the value's element identity. The default path renders a
  // static `<span>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <span
        {...(rest as Record<string, unknown>)}
        data-placeholder={(store.select("hasSelectedValue") as boolean) ? undefined : ""}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={ref}
      >
        {resolveChildren()}
      </span>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-placeholder={(store.select("hasSelectedValue") as boolean) ? undefined : ""}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={ref}
    >
      {resolveChildren()}
    </Tag>
  );
}

function resolveMultipleLabels(
  value: ReadonlyArray<unknown>,
  items: SelectItemsInput,
  itemToStringLabel: ((item: unknown) => string) | undefined,
): string {
  return value.map((item) => String(resolveSelectedLabel(item, items, itemToStringLabel) ?? "")).join(", ");
}

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

export type SelectValueProps<T extends JSX.ElementType = "span"> = SelectValueOwnProps &
  Omit<RebaseUIComponentProps<T, SelectValueState>, "children">;

export namespace SelectValue {
  export type State = SelectValueState;
  export type Props<T extends JSX.ElementType = "span"> = SelectValueProps<T>;
  export type OwnProps = SelectValueOwnProps;
}

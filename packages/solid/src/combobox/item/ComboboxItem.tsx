import { isServer, type ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, onCleanup, untrack } from "solid-js";

import { CompositeListContext } from "../../internals/composite/list/CompositeListContext";
import { useCompositeListItem } from "../../internals/composite/list/useCompositeListItem";
import { useContext } from "../../internals/context";
import { createButton } from "../../internals/create-button";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { compareItemEquality, findItemIndex, resolveSelectedIndex } from "../../select/utils/itemEquality";
import { useComboboxDerivedItemsContext, useComboboxHasItemsContext, useComboboxRootContext } from "../root/ComboboxRootContext";
import { useComboboxRowContext } from "../row/ComboboxRowContext";
import type { ComboboxStore } from "../store/ComboboxStore";
import { ComboboxItemContext } from "./ComboboxItemContext";
import * as ComboboxItemDataAttributes from "./ComboboxItemDataAttributes";

interface ComboboxItemInnerProps {
  componentProps: ComboboxItem.Props;
  /**
   * Whether the list is externally virtualized. Resolved once by the wrapper so the
   * two branches stay stable for the item's lifetime.
   */
  virtualized: boolean;
  /**
   * Pre-resolved index for the virtualized fallback (when no `index` prop is provided).
   * `undefined` for the common path, where the index comes from the `index` prop or the
   * composite list registration order.
   */
  indexFromFilter: number | undefined;
}

function ComboboxItemInner(props: ComboboxItemInnerProps) {
  const [local, elementProps] = split(props.componentProps as ComboboxItem.Props, { default: defaultProps }, [
    "as",
    "value",
    "index",
    "disabled",
    "nativeButton",
  ]);

  const as = untrack(() => local.as);
  const indexProp = untrack(() => local.index);
  const virtualized = untrack(() => props.virtualized);
  const indexFromFilter = untrack(() => props.indexFromFilter);

  const store = useComboboxRootContext() as ComboboxStore;
  const isRow = useComboboxRowContext();

  // Item registration comes from the root-provided composite list (a list-level
  // provider would stay invisible: Solid providers only deliver context to JSX
  // evaluated inside them). Virtualized lists skip it and rely on the explicit
  // `index` prop (or the filtered-values fallback) instead.
  const compositeContext = useContext(CompositeListContext);
  const listItem = compositeContext === undefined ? undefined : useCompositeListItem();
  const textRef: { current: HTMLElement | null } = { current: null };

  const disabled = () => store.select("disabled") || local.disabled;
  // The context hook reads an accessor, so it must run in a tracked scope. Cache it in a
  // memo: ref callbacks and cleanups run without an owner and cannot call the hook directly.
  const hasItems = createMemo(() => useComboboxHasItemsContext());
  const index = () => indexProp ?? indexFromFilter ?? listItem?.index() ?? -1;

  const highlighted = () => store.select("isActive", index()) as boolean;
  const matchesSelectedValue = () => store.select("isSelected", local.value ?? null) as boolean;
  const selectable = () => (store.select("selectionMode") as string) !== "none";
  const selected = () => matchesSelectedValue() && selectable();

  let itemElement: HTMLElement | null = null;

  function syncStoreRefs(element: HTMLElement | null, itemIndex: number) {
    if (itemIndex === -1) {
      return;
    }
    if (virtualized || indexProp != null) {
      if (element === null) {
        delete store.context.listRef.current[itemIndex];
      } else {
        store.context.listRef.current[itemIndex] = element;
      }
    }
  }

  // Called from ref callbacks and effect applies — imperative scopes where a read cannot
  // subscribe, so the registry flag is snapshotted.
  function syncValueRef(itemIndex: number, itemValue: unknown) {
    if (itemIndex === -1 || untrack(hasItems)) {
      return;
    }
    if (itemValue === undefined) {
      delete store.context.valuesRef.current[itemIndex];
    } else {
      store.context.valuesRef.current[itemIndex] = itemValue;
    }
  }

  // Solid has no `onPointerDownCapture` prop (`on*Capture` names bind a literal
  // `pointerdowncapture` listener that never fires), so the capture-phase
  // handler is attached imperatively.
  function handlePointerDownCapture(event: PointerEvent) {
    // The `mouseup` pairing only fires for the primary pointer, so a non-primary
    // touch must not overwrite the shared ref — a mismatch would make the primary
    // pointer's release read as a drag-select and commit a second time after `click`.
    if (event.isPrimary) {
      store.context.pointerDownItemRef.current = event.currentTarget as Element;
    }
    event.preventDefault();
  }

  function setItemElement(element: HTMLElement | null) {
    const prevIndex = itemElement === null ? -1 : untrack(index);
    if (prevIndex !== -1 && element === null) {
      syncStoreRefs(null, prevIndex);
    }
    itemElement?.removeEventListener("pointerdown", handlePointerDownCapture, true);
    itemElement = element;
    if (element !== null) {
      element.addEventListener("pointerdown", handlePointerDownCapture, true);
      const itemIndex = untrack(index);
      syncStoreRefs(element, itemIndex);
      syncValueRef(
        itemIndex,
        untrack(() => local.value ?? null),
      );
    }
  }

  onCleanup(() => {
    if (isServer) return;
    setItemElement(null);
  });

  // Claims the selected index for the current value and refreshes the shared registries,
  // mirroring upstream's layout effect. Only runs without the `items` prop, where labels
  // are derived from rendered text: with `items`, filtering owns the values instead.
  // Runs while closed as well so the index tracks the composite position, keeping
  // closed-trigger typeahead in sync when the rendered order changes.
  createEffect(
    () => ({
      itemIndex: index(),
      value: local.value ?? null,
      selectedValue: store.select("selectedValue"),
      selectionMode: store.select("selectionMode"),
      comparer: store.select("isItemEqualToValue"),
      hasItems: hasItems(),
    }),
    ({ itemIndex, value, selectedValue, selectionMode, comparer, hasItems }) => {
      if (itemIndex === -1 || hasItems) {
        return undefined;
      }
      syncValueRef(itemIndex, value);

      let nextIndex = store.peek("selectedIndex") as number | null;
      if (selectionMode === "multiple" && Array.isArray(selectedValue)) {
        nextIndex = resolveSelectedIndex(itemIndex, value, store.context.valuesRef.current, selectedValue, comparer, nextIndex);
      } else if (compareItemEquality(value, selectedValue, comparer)) {
        nextIndex = itemIndex;
      }
      store.set("selectedIndex", nextIndex);
      return undefined;
    },
  );

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: () => true,
    native: () => local.nativeButton,
    composite: () => true,
  });

  function commitSelection(nativeEvent: MouseEvent | PointerEvent | KeyboardEvent) {
    function selectItem() {
      store.context.handleSelection(
        nativeEvent,
        untrack(() => local.value ?? null),
      );
    }

    if (store.peek("submitOnItemClick") as boolean) {
      // The store snapshot updates synchronously (unlike React state), so the selection
      // is already committed when the submit reads it — no flushSync equivalent needed.
      selectItem();
      store.context.requestSubmit();
    } else {
      selectItem();
    }
  }

  const defaultItemProps = {
    get id() {
      const rootId = store.select("id") as string | undefined;
      const itemIndex = index();
      return rootId != null && itemIndex !== -1 ? `${rootId}-${itemIndex}` : undefined;
    },
    get role() {
      return isRow ? ("gridcell" as const) : ("option" as const);
    },
    get "aria-selected"() {
      return selectable() ? (selected() ? "true" : "false") : undefined;
    },
    // Focusable items steal focus from the input upon mouseup, so items stay
    // unfocusable: the input keeps focus while the user picks an item.
    tabIndex: undefined as number | undefined,
    onMouseDown(event: MouseEvent) {
      // iOS Safari can emit a synthetic mousedown for touch taps without a preceding
      // pointerdown. Prevent default here too so tapping an item does not blur the input.
      event.preventDefault();
    },
    onClick(event: MouseEvent) {
      if (disabled() || (store.peek("readOnly") as boolean)) {
        return;
      }
      commitSelection(event);
    },
    onMouseUp(event: MouseEvent) {
      const pointerStartedOnItem = store.context.pointerDownItemRef.current === event.currentTarget;
      store.context.pointerDownItemRef.current = null;

      if (
        disabled() ||
        (store.peek("readOnly") as boolean) ||
        event.button !== 0 ||
        pointerStartedOnItem ||
        !store.peek("isActive", untrack(index))
      ) {
        return;
      }

      commitSelection(event);
    },
  };

  const state: ComboboxItemState = {
    disabled,
    selected,
    highlighted,
  };

  const stateAttributesMapping: StateAttributesMapping<ComboboxItemState> = {
    disabled: {
      keys: [ComboboxItemDataAttributes.disabled],
      map: (value) => (value ? { [ComboboxItemDataAttributes.disabled]: "" } : null),
    },
    selected: {
      keys: [ComboboxItemDataAttributes.selected],
      map: (value) => (value ? { [ComboboxItemDataAttributes.selected]: "" } : null),
    },
    highlighted: {
      keys: [ComboboxItemDataAttributes.highlighted],
      map: (value) => (value ? { [ComboboxItemDataAttributes.highlighted]: "" } : null),
    },
  };

  const contextValue: ComboboxItemContext = {
    selected,
    textRef,
  };

  const ref = mergeRefs<HTMLElement | null>(buttonRef, listItem?.ref, setItemElement);

  return (
    <ComboboxItemContext value={contextValue}>
      <RenderElement
        as={as}
        state={state}
        props={[() => store.select("itemProps") as Record<string, unknown>, defaultItemProps, elementProps, getButtonProps, { ref }]}
        stateAttributesMapping={stateAttributesMapping}
      />
    </ComboboxItemContext>
  );
}
function ComboboxItemVirtualizedIndex(props: { componentProps: ComboboxItem.Props; virtualized: boolean }) {
  const store = useComboboxRootContext() as ComboboxStore;
  const derived = useComboboxDerivedItemsContext();

  const lookupValue = untrack(() => (props.componentProps as ComboboxItem.Props).value ?? null);
  const indexFromFilter = () => findItemIndex(derived.flatFilteredValues, lookupValue, store.select("isItemEqualToValue"));
  return <ComboboxItemInner componentProps={props.componentProps} virtualized={props.virtualized} indexFromFilter={indexFromFilter()} />;
}

/**
 * An individual item in the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxItem<T extends ValidComponent = "div">(props: ComboboxItem.Props<T>) {
  const store = useComboboxRootContext() as ComboboxStore;
  // `virtualized` (and whether an item provides an explicit `index`) must be stable for an
  // item's lifetime: the two branches return different component types, so flipping it at
  // runtime remounts the item and resets its refs and effects.
  const virtualized = untrack(() => store.select("virtualized") as boolean);
  const hasExplicitIndex = untrack(() => (props as ComboboxItem.Props).index != null);

  if (virtualized && !hasExplicitIndex) {
    return <ComboboxItemVirtualizedIndex componentProps={props} virtualized={virtualized} />;
  }

  return <ComboboxItemInner componentProps={props} virtualized={virtualized} indexFromFilter={undefined} />;
}

const defaultProps = Object.freeze({
  as: "div",
  value: null,
  disabled: false,
  nativeButton: false,
} satisfies Partial<ComboboxItem.Props>);

export interface ComboboxItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether the item is selected.
   */
  selected: Accessor<boolean>;
  /**
   * Whether the item is highlighted.
   */
  highlighted: Accessor<boolean>;
}

export interface ComboboxItemOwnProps extends NonNativeButtonProps {
  children?: unknown;
  /**
   * An optional click handler for the item when selected.
   * It fires when clicking the item with the pointer, as well as when pressing `Enter` with the keyboard if the item is highlighted when the `Input` or `List` element has focus.
   */
  onClick?: ((event: MouseEvent) => void) | undefined;
  /**
   * The index of the item in the list. Improves performance when specified by avoiding the need to calculate the index automatically from the DOM.
   */
  index?: number | undefined;
  /**
   * A unique value that identifies this item.
   * @default null
   */
  value?: unknown;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type ComboboxItemProps<T extends ValidComponent = "div"> = ComboboxItemOwnProps &
  Omit<RebaseUIComponentProps<T, ComboboxItemState>, "id" | "value">;

export namespace ComboboxItem {
  export type State = ComboboxItemState;
  export type Props<T extends ValidComponent = "div"> = ComboboxItemProps<T>;
  export type OwnProps = ComboboxItemOwnProps;
}

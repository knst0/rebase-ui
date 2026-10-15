import { compareItemEquality, findItemIndex, resolveSelectedIndex } from "@rebase-ui/core/itemEquality";
import { dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, untrack, useContext, type JSX } from "reze-js";

import { CompositeListContext } from "../../internals/composite/list/CompositeListContext";
import { useCompositeListItem } from "../../internals/composite/list/useCompositeListItem";
import { createButton } from "../../internals/create-button";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { ComboboxHasItemsContext, useComboboxDerivedItemsContext, useComboboxRootContext } from "../root/ComboboxRootContext";
import { useComboboxRowContext } from "../row/ComboboxRowContext";
import type { ComboboxStore } from "../store/ComboboxStore";
import { ComboboxItemContext } from "./ComboboxItemContext";

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
  const componentProps = props.componentProps;
  // User handlers replace the interaction/default handlers (matching the Solid layer, where
  // `elementProps` override earlier layers): resolve each with the internal one as fallback.
  const rest = omitProps(
    componentProps as Record<string, unknown>,
    "as",
    "value",
    "index",
    "disabled",
    "nativeButton",
    "onClick",
    "onMouseDown",
    "onMouseUp",
    "onMouseMove",
    "onPointerLeave",
    "onKeyDown",
    "onKeyUp",
    "onPointerDown",
    "class",
    "style",
    "children",
    "ref",
  );
  // Deliberately not hoisted: item children must be created inside the item
  // context provider below (ComboboxItemContent reads them there), not in
  // this body. An eager read here would create context-consuming parts
  // (e.g. ItemIndicator) outside the provider and throw.

  const indexProp = componentProps.index;
  const virtualized = props.virtualized;
  const indexFromFilter = props.indexFromFilter;
  const nativeButton = componentProps.nativeButton ?? false;

  const store = useComboboxRootContext() as ComboboxStore;
  const isRow = useComboboxRowContext();

  // Item registration comes from the root-provided composite list (a list-level
  // provider would stay invisible: providers only deliver context to JSX
  // evaluated inside them). Virtualized lists skip it and rely on the explicit
  // `index` prop (or the filtered-values fallback) instead.
  const compositeContext = useContext(CompositeListContext);
  const listItem = compositeContext === undefined ? undefined : useCompositeListItem();
  const textRef: { current: HTMLElement | null } = { current: null };

  function disabled() {
    return Boolean(store.select("disabled") || componentProps.disabled);
  }
  // Capture the context accessor in the body (a tracked scope with an owner): ref callbacks
  // and cleanups run without an owner and cannot call the context hook directly, but they
  // can invoke the captured accessor, which reads the static `items` prop.
  const hasItemsContext = useContext(ComboboxHasItemsContext);
  if (hasItemsContext === undefined) {
    throw new Error("Rebase UI: ComboboxHasItemsContext is missing. Combobox parts must be placed within <Combobox.Root>.");
  }
  // Aliased: narrowing does not persist into the function body below.
  const hasItemsFn: () => boolean = hasItemsContext;
  function hasItems() {
    return hasItemsFn();
  }
  function index() {
    return indexProp ?? indexFromFilter ?? listItem?.index() ?? -1;
  }

  function highlighted() {
    return store.select("isActive", index()) as boolean;
  }
  function matchesSelectedValue() {
    return store.select("isSelected", componentProps.value ?? null) as boolean;
  }
  function selectable() {
    return (store.select("selectionMode") as string) !== "none";
  }
  function selected() {
    return matchesSelectedValue() && selectable();
  }

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

  // Called from ref callbacks and effect continuations — imperative scopes where a read cannot
  // subscribe, so the registry flag is read through the captured context accessor.
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

  // The capture-phase handler is attached imperatively (there is no `on*Capture` prop
  // that binds a capture listener).
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
        untrack(() => componentProps.value ?? null),
      );
    }
  }

  onCleanup(() => {
    setItemElement(null);
  });

  // Claims the selected index for the current value and refreshes the shared registries,
  // mirroring upstream's layout effect. Only runs without the `items` prop, where labels
  // are derived from rendered text: with `items`, filtering owns the values instead.
  // Runs while closed as well so the index tracks the composite position, keeping
  // closed-trigger typeahead in sync when the rendered order changes.
  effect(() => {
    const deps = {
      itemIndex: index(),
      value: componentProps.value ?? null,
      selectedValue: store.select("selectedValue"),
      selectionMode: store.select("selectionMode"),
      comparer: store.select("isItemEqualToValue"),
      hasItems: hasItems(),
    };
    // One-shot continuation: the snapshot below is consumed, never tracked.
    untrack(() => {
      const { itemIndex, value, selectedValue, selectionMode, comparer, hasItems } = deps;
      if (itemIndex === -1 || hasItems) {
        return;
      }
      syncValueRef(itemIndex, value);

      let nextIndex = store.peek("selectedIndex") as number | null;
      if (selectionMode === "multiple" && Array.isArray(selectedValue)) {
        nextIndex = resolveSelectedIndex(itemIndex, value, store.context.valuesRef.current, selectedValue, comparer, nextIndex);
      } else if (compareItemEquality(value, selectedValue, comparer)) {
        nextIndex = itemIndex;
      }
      store.set("selectedIndex", nextIndex);
    });
  });

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return true;
    },
    get nativeButton() {
      return nativeButton;
    },
    get onClick() {
      return handleClick;
    },
    get onMouseDown() {
      return handleMouseDownButton;
    },
    get onKeyDown() {
      return componentProps.onKeyDown as ((event: KeyboardEvent) => void) | undefined;
    },
    get onKeyUp() {
      return componentProps.onKeyUp as ((event: KeyboardEvent) => void) | undefined;
    },
    get onPointerDown() {
      return componentProps.onPointerDown as ((event: PointerEvent) => void) | undefined;
    },
  });

  function commitSelection(nativeEvent: MouseEvent | PointerEvent | KeyboardEvent) {
    function selectItem() {
      store.context.handleSelection(
        nativeEvent,
        untrack(() => componentProps.value ?? null),
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

  function handleClick(event: MouseEvent) {
    const user = componentProps.onClick as ((event: MouseEvent) => void) | undefined;
    if (user) {
      user(event);
      return;
    }
    if (disabled() || (store.peek("readOnly") as boolean)) {
      return;
    }
    commitSelection(event);
  }

  function handleMouseDownButton(event: MouseEvent) {
    const user = (componentProps as Record<string, unknown>).onMouseDown as ((event: MouseEvent) => void) | undefined;
    if (user) {
      user(event);
      return;
    }
    // iOS Safari can emit a synthetic mousedown for touch taps without a preceding
    // pointerdown. Prevent default here too so tapping an item does not blur the input.
    event.preventDefault();
  }

  function handleMouseUp(event: MouseEvent) {
    const user = (componentProps as Record<string, unknown>).onMouseUp as ((event: MouseEvent) => void) | undefined;
    if (user) {
      user(event);
      return;
    }
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
  }

  function handleMouseMove(event: MouseEvent) {
    const user = (componentProps as Record<string, unknown>).onMouseMove as ((event: MouseEvent) => void) | undefined;
    if (user) {
      user(event);
      return;
    }
    (interactionProps().onMouseMove as ((event: MouseEvent) => void) | undefined)?.(event);
  }

  function handlePointerLeave(event: PointerEvent) {
    const user = (componentProps as Record<string, unknown>).onPointerLeave as ((event: PointerEvent) => void) | undefined;
    if (user) {
      user(event);
      return;
    }
    (interactionProps().onPointerLeave as ((event: PointerEvent) => void) | undefined)?.(event);
  }

  function itemId(): string | undefined {
    const rootId = store.select("id") as string | undefined;
    const itemIndex = index();
    return rootId != null && itemIndex !== -1 ? `${rootId}-${itemIndex}` : undefined;
  }

  function snapshot(): ComboboxItemState {
    return { disabled: disabled(), selected: selected(), highlighted: highlighted() };
  }

  function interactionProps(): Record<string, unknown> {
    return store.select("itemProps") as Record<string, unknown>;
  }

  const contextValue: ComboboxItemContext = {
    selected,
    textRef,
  };

  const Tag = dynamicElement<JSX.ElementType>(() => componentProps.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the item parts without context. Children
  // resolve in ComboboxItemContent below so they are created inside the provider.
  //
  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (componentProps.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        id={itemId()}
        role={isRow ? "gridcell" : "option"}
        aria-selected={selectable() ? (selected() ? "true" : "false") : undefined}
        tabindex={undefined}
        {...{ type: button.type }}
        bool:disabled={button.disabled}
        aria-disabled={button.ariaDisabled}
        onMouseDown={button.onMouseDown}
        onClick={button.onClick}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onPointerLeave={handlePointerLeave}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        data-disabled={disabled() ? "" : undefined}
        data-selected={selected() ? "" : undefined}
        data-highlighted={highlighted() ? "" : undefined}
        class={resolveClassValue(componentProps.class, snapshot())}
        style={resolveStyleValue(componentProps.style, snapshot())}
        ref={mergeRefs(
          button.buttonRef,
          listItem?.ref,
          setItemElement,
          componentProps.ref as ((element: HTMLElement | null) => void) | undefined,
        )}
      >
        <ComboboxItemContext value={contextValue}>
          <ComboboxItemContent disabled={disabled()} selected={selected()} highlighted={highlighted()}>
            {componentProps.children}
          </ComboboxItemContent>
        </ComboboxItemContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={itemId()}
      role={isRow ? "gridcell" : "option"}
      aria-selected={selectable() ? (selected() ? "true" : "false") : undefined}
      tabindex={undefined}
      type={button.type}
      bool:disabled={button.disabled}
      aria-disabled={button.ariaDisabled}
      onMouseDown={button.onMouseDown}
      onClick={button.onClick}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onPointerLeave={handlePointerLeave}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      data-disabled={disabled() ? "" : undefined}
      data-selected={selected() ? "" : undefined}
      data-highlighted={highlighted() ? "" : undefined}
      class={resolveClassValue(componentProps.class, snapshot())}
      style={resolveStyleValue(componentProps.style, snapshot())}
      ref={mergeRefs(
        button.buttonRef,
        listItem?.ref,
        setItemElement,
        componentProps.ref as ((element: HTMLElement | null) => void) | undefined,
      )}
    >
      <ComboboxItemContext value={contextValue}>
        <ComboboxItemContent disabled={disabled()} selected={selected()} highlighted={highlighted()}>
          {componentProps.children}
        </ComboboxItemContent>
      </ComboboxItemContext>
    </Tag>
  );
}

/**
 * Resolves the item children inside the item context.
 */
function ComboboxItemContent(props: { children: unknown; disabled: boolean; selected: boolean; highlighted: boolean }) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: ComboboxItemState) => JSX.Element;
    const owner = getOwner();

    return () => {
      const snapshot: ComboboxItemState = { disabled: props.disabled, selected: props.selected, highlighted: props.highlighted };
      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

function ComboboxItemVirtualizedIndex(props: { componentProps: ComboboxItem.Props; virtualized: boolean }) {
  const store = useComboboxRootContext() as ComboboxStore;
  const derived = useComboboxDerivedItemsContext();

  const lookupValue = untrack(() => (props.componentProps as ComboboxItem.Props).value ?? null);
  function indexFromFilter() {
    return findItemIndex(derived.flatFilteredValues, lookupValue, store.select("isItemEqualToValue"));
  }
  return <ComboboxItemInner componentProps={props.componentProps} virtualized={props.virtualized} indexFromFilter={indexFromFilter()} />;
}

/**
 * An individual item in the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxItem<T extends JSX.ElementType = "div">(props: ComboboxItem.Props<T>) {
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

export interface ComboboxItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
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

export type ComboboxItemProps<T extends JSX.ElementType = "div"> = ComboboxItemOwnProps &
  ButtonEventHandlers &
  Omit<RebaseUIComponentProps<T, ComboboxItemState>, "id" | "value">;

export namespace ComboboxItem {
  export type State = ComboboxItemState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxItemProps<T>;
  export type OwnProps = ComboboxItemOwnProps;
}

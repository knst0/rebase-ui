import { dynamicElement, effect, For, omitProps, untrack, type JSX } from "reze-js";

import { useCompositeListContext } from "../../internals/composite";
import { stopEvent } from "../../internals/floating/utils/event";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { useComboboxPositionerContext } from "../positioner/ComboboxPositionerContext";
import { useComboboxDerivedItemsContext, useComboboxFloatingContext, useComboboxRootContext } from "../root/ComboboxRootContext";

/**
 * A list container for the items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxList<T extends JSX.ElementType = "div">(props: ComboboxList.Props<T>) {
  const rest = omitProps(props, "as", "children", "onKeyDown", "class", "style", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const childrenProp = props.children;

  const store = useComboboxRootContext();
  const floatingRootContext = useComboboxFloatingContext();
  const hasPositionerContext = useComboboxPositionerContext(true) !== undefined;
  const derivedItems = useComboboxDerivedItemsContext() as unknown as {
    filteredItems: unknown[] | (() => unknown[]);
    hasItems: boolean | (() => boolean);
  };

  function getFilteredItems(): unknown[] {
    const filteredItems = derivedItems.filteredItems;
    return typeof filteredItems === "function" ? filteredItems() : filteredItems;
  }

  function getHasItems(): boolean {
    const hasItems = derivedItems.hasItems;
    return typeof hasItems === "function" ? hasItems() : hasItems;
  }

  function multiple() {
    return (store.select("selectionMode") as string) === "multiple";
  }

  function snapshot(): ComboboxListState {
    return { empty: getFilteredItems().length === 0 };
  }

  // The composite registry is created and provided by the root (upstream wraps
  // the list element in the composite provider instead; a provider
  // only delivers context to JSX evaluated inside it, so a list-level provider
  // would stay invisible to the items). Items register into the ancestor
  // registry, which this effect mirrors into the store's element/label arrays.
  const compositeList = useCompositeListContext<{ label?: string | null }>();
  effect(() => {
    const deps = { map: compositeList.map(), hasItems: getHasItems() };
    // One-shot sync: the values only steer these writes.
    untrack(() => {
      const { map, hasItems } = deps;
      const nextElements: Array<HTMLElement | null> = Array.from({ length: map.size });
      const nextLabels: Array<string | null> = Array.from({ length: map.size });
      for (const [element, entry] of map) {
        nextElements[entry.index] = element;
        nextLabels[entry.index] = entry.label ?? element.textContent ?? null;
      }
      store.context.listRef.current = nextElements;
      if (!(hasItems && !store.peek("forceMounted"))) {
        store.context.labelsRef.current = nextLabels;
      }
    });
  });

  function renderChildren(): JSX.Element {
    if (typeof childrenProp === "function") {
      // A single component child arrives as a zero-arg thunk (the renderer evaluates
      // component children lazily), not as the closed-template render-prop:
      // call it once instead of mapping it over the filtered items. A
      // render-prop taking (item, index) keeps the upstream closed-template
      // behavior below. Arity discriminates the two: thunks take no arguments.
      if ((childrenProp as (...args: Array<never>) => JSX.Element).length === 0) {
        return (childrenProp as () => JSX.Element)();
      }
      // Support "closed template" API: implicitly map over the filtered items, mirroring
      // upstream's implicit `Combobox.Collection` wrapper. Positional reconciliation matches
      // Solid's `<For>`; the thunk re-renders the row when its item updates.
      return (
        <For each={getFilteredItems()} keyed={false}>
          {(item, index) => (() => (childrenProp as (item: unknown, index: number) => JSX.Element)(item, index)) as unknown as JSX.Element}
        </For>
      );
    }
    return childrenProp as JSX.Element;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (store.peek("disabled") || store.peek("readOnly")) {
      return;
    }

    if (event.key === "Enter") {
      const activeIndex = store.peek("activeIndex") as number | null;

      if (activeIndex == null) {
        // Allow form submission when no item is highlighted.
        return;
      }

      stopEvent(event);
      const listItem = store.context.listRef.current[activeIndex];
      if (listItem) {
        store.context.selectionEventRef.current = event;
        listItem.click();
        store.context.selectionEventRef.current = null;
      }
    }
  }

  // A user handler replaces the internal one (matching the Solid layer, where
  // `elementProps` override `listProps`).
  function resolveKeyDown(): ((event: KeyboardEvent) => void) | undefined {
    return (props.onKeyDown as ((event: KeyboardEvent) => void) | undefined) ?? handleKeyDown;
  }

  function grid() {
    return store.select("grid") as boolean;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        tabindex={-1}
        id={floatingRootContext.select("floatingId") as string | undefined}
        role={grid() ? "grid" : "listbox"}
        aria-multiselectable={multiple() ? ("true" as const) : undefined}
        aria-readonly={!grid() && (store.select("readOnly") as boolean) ? ("true" as const) : undefined}
        onKeyDown={resolveKeyDown()}
        data-empty={getFilteredItems().length === 0 ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLDivElement | null) => {
          store.set("listElement", element);
          if (!hasPositionerContext) {
            store.set("positionerElement", element);
          }
        })}
      >
        {renderChildren()}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      tabindex={-1}
      id={floatingRootContext.select("floatingId") as string | undefined}
      role={grid() ? "grid" : "listbox"}
      aria-multiselectable={multiple() ? ("true" as const) : undefined}
      aria-readonly={!grid() && (store.select("readOnly") as boolean) ? ("true" as const) : undefined}
      onKeyDown={resolveKeyDown()}
      data-empty={getFilteredItems().length === 0 ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLDivElement | null) => {
        store.set("listElement", element);
        if (!hasPositionerContext) {
          store.set("positionerElement", element);
        }
      })}
    >
      {renderChildren()}
    </Tag>
  );
}

export interface ComboboxListState {
  /**
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxListOwnProps {
  /**
   * A function child renders the filtered items ("closed template"), mirroring
   * an implicit `Combobox.Collection`. The item type is opaque here; annotate
   * it at the call site.
   */
  children?: JSX.Element | ((item: any, index: number) => JSX.Element);
}

export type ComboboxListProps<T extends JSX.ElementType = "div"> = ButtonEventHandlers &
  Omit<RebaseUIComponentProps<T, ComboboxListState>, "children"> &
  ComboboxListOwnProps;

export namespace ComboboxList {
  export type State = ComboboxListState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxListProps<T>;
}

import type { JSX, ValidComponent } from "@solidjs/web";
import { createEffect, createMemo, For, untrack } from "solid-js";

import { useCompositeListContext } from "../../internals/composite";
import { stopEvent } from "../../internals/floating/utils/event";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxPositionerContext } from "../positioner/ComboboxPositionerContext";
import { useComboboxDerivedItemsContext, useComboboxFloatingContext, useComboboxRootContext } from "../root/ComboboxRootContext";

/**
 * A list container for the items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxList<T extends ValidComponent = "div">(props: ComboboxList.Props<T>) {
  const [local, elementProps] = split(props as ComboboxList.Props, { default: defaultProps }, ["as", "children"]);

  const as = untrack(() => local.as);
  const childrenProp = untrack(() => local.children);

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

  const multiple = () => (store.select("selectionMode") as string) === "multiple";

  const state: ComboboxListState = {
    get empty() {
      return getFilteredItems().length === 0;
    },
  };

  // The composite registry is created and provided by the root (upstream wraps
  // the list element in the composite provider instead; in Solid a provider
  // only delivers context to JSX evaluated inside it, so a list-level provider
  // would stay invisible to the items). Items register into the ancestor
  // registry, which this effect mirrors into the store's element/label arrays.
  const compositeList = useCompositeListContext<{ label?: string | null }>();
  createEffect(
    // The apply callback is untracked, so every reactive value it needs must
    // be read in this compute function.
    () => ({ map: compositeList.map(), hasItems: getHasItems() }),
    ({ map, hasItems }) => {
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
      return undefined;
    },
  );

  const listProps = {
    get children(): JSX.Element {
      if (typeof childrenProp === "function") {
        // A single component child arrives as a zero-arg thunk (Solid evaluates
        // component children lazily), not as the closed-template render-prop:
        // call it once instead of mapping it over the filtered items. A
        // render-prop taking (item, index) keeps the upstream closed-template
        // behavior below. Like `Show` and `flatten`, arity discriminates the
        // two: thunks take no arguments.
        if ((childrenProp as (...args: Array<never>) => JSX.Element).length === 0) {
          return (childrenProp as () => JSX.Element)();
        }
        // Support "closed template" API: implicitly map over the filtered items, mirroring
        // upstream's implicit `Combobox.Collection` wrapper.
        return (
          <For each={getFilteredItems()}>
            {(item: unknown, index) => {
              // `For` runs its mapper untracked, so reading `index()` here
              // would never subscribe. Resolve it inside a per-row memo (a
              // tracking scope) and read the memo from JSX instead.
              const rendered = createMemo(() => (childrenProp as (item: unknown, index: number) => JSX.Element)(item, index()));
              return <>{rendered()}</>;
            }}
          </For>
        );
      }
      return childrenProp as JSX.Element;
    },
    tabindex: -1,
    get id() {
      return floatingRootContext.select("floatingId") as string | undefined;
    },
    get role(): "grid" | "listbox" {
      return (store.select("grid") as boolean) ? "grid" : "listbox";
    },
    get "aria-multiselectable"() {
      return multiple() ? ("true" as const) : undefined;
    },
    // On a grid the attribute describes cell editability, not selection, so it's left to the
    // combobox element in that mode.
    get "aria-readonly"() {
      return !(store.select("grid") as boolean) && (store.select("readOnly") as boolean) ? ("true" as const) : undefined;
    },
    onKeyDown(event: KeyboardEvent) {
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
    },
  };

  // Solid has no `on*Capture` props (such a name binds a literal
  // `keydowncapture` listener that never fires), so capture-phase listeners
  // are attached imperatively.
  function trackKeyboardActive() {
    store.context.keyboardActiveRef.current = true;
  }

  function trackPointerActive() {
    store.context.keyboardActiveRef.current = false;
  }

  let listElement: HTMLDivElement | null = null;

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, (element: HTMLDivElement | null) => {
      listElement?.removeEventListener("keydown", trackKeyboardActive, true);
      listElement?.removeEventListener("pointermove", trackPointerActive, true);
      listElement = element;
      element?.addEventListener("keydown", trackKeyboardActive, true);
      element?.addEventListener("pointermove", trackPointerActive, true);
      store.set("listElement", element);
      if (!hasPositionerContext) {
        store.set("positionerElement", element);
      }
    }),
  });

  return <RenderElement as={as} state={state} props={[listProps, elementProps, refProps]} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ComboboxList.Props>);

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

export type ComboboxListProps<T extends ValidComponent = "div"> = Omit<RebaseUIComponentProps<T, ComboboxListState>, "children"> &
  ComboboxListOwnProps;

export namespace ComboboxList {
  export type State = ComboboxListState;
  export type Props<T extends ValidComponent = "div"> = ComboboxListProps<T>;
}

import { createEffect, untrack } from "solid-js";

import { useFilterDropdownItem } from "../../filter-dropdown/item/useFilterDropdownItem";
import { useFilterContextForList } from "../../filter-dropdown/root/FilterDropdownRootContext";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { isVirtualPointerEvent } from "../../internals/floating/utils/event";
import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuFilterItemParams, MenuFilterItemResult } from "./MenuFilterContext";

/**
 * Registers a submenu trigger with the parent menu's filter and adapts it to a filterable
 * submenu: the trigger lives inside its own submenu root, but it is an item of the parent list.
 */
export function useMenuFilterSubmenuTrigger(params: MenuFilterItemParams): MenuFilterItemResult {
  // `virtualFocus` is set only by a filterable submenu root, so it tells this trigger whether the
  // submenu it opens renders a `role="dialog"` popup or a plain `role="menu"` one. The documented
  // plain-submenu recipe relies on the latter.
  const { store, virtualFocus } = useMenuRootContext();

  const open = () => store.select("open") as boolean;
  const mounted = () => store.select("mounted") as boolean;

  // The submenu root's provider shadows the enclosing one, but the trigger belongs to the list
  // it opens from, which is the parent menu's.
  const parent = untrack(() => store.peek("parent")) as { type: "menu"; store: typeof store } | { type: undefined };
  const parentListRef = parent.type === "menu" ? parent.store.context.itemDomElements : null;
  const parentContext = useFilterContextForList(parentListRef);

  const { visible, ref } = useFilterDropdownItem({
    ...params,
    context: parentContext,
    retainGroup: untrack(mounted),
  });

  // Filtering the trigger out unmounts it, leaving its submenu open with no anchor.
  createEffect(
    () => ({ visible: visible(), open: open() }),
    ({ visible: isVisible, open: isOpen }) => {
      if (!isVisible && isOpen) {
        store.setOpen(false, createChangeEventDetails(REASONS.none));
      }
      return undefined;
    },
  );

  const props = {
    // Omitted rather than `undefined`, which would clear the `'menu'` the root puts on every
    // trigger.
    ...(virtualFocus ? { "aria-haspopup": "dialog" as const } : undefined),
    onPointerDown(event: PointerEvent) {
      store.context.virtualPress = isVirtualPointerEvent(event);
    },
    onFocus(event: FocusEvent & { relatedTarget: EventTarget | null }) {
      // A plain parent menu moves DOM focus to whichever item the pointer crosses. While this
      // trigger's submenu is open and its input held focus, hand focus straight back so crossing
      // the trigger doesn't interrupt typing.
      const focusOwner = store.context.virtualFocusRef?.current;
      if (focusOwner && untrack(() => store.peek("open")) && event.relatedTarget === focusOwner) {
        focusOwner.focus({ preventScroll: true });
      }
    },
  };

  if (parentContext === null) {
    // A plain parent menu roves DOM focus across its items and never filters them.
    return { visible: () => true, ref: null, props };
  }

  return {
    visible: () => visible() || mounted(),
    ref: (element: HTMLElement | null) => {
      ref.current = element;
    },
    props,
  };
}

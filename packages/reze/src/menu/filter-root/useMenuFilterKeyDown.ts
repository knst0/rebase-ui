import { untrack } from "reze-js";

import { dispatchClickWithModifiers } from "../../internals/dispatchClickWithModifiers";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import {
  isCrossOrientationCloseKey,
  isCrossOrientationOpenKey,
  isMainOrientationKey,
} from "../../internals/floating/interactions/createListNavigation";
import { getMaxListIndex, getMinListIndex } from "../../internals/floating/utils/composite";
import { stopEvent } from "../../internals/floating/utils/event";
import type { MenuRoot } from "../root/MenuRoot";
import { useMenuRootContext } from "../root/MenuRootContext";
import { useMenuSubmenuRootContext } from "../submenu-root/MenuSubmenuRootContext";

export type MenuFilterKeyAction =
  /** Native text editing in the input; list navigation and parent handlers stay out of it. */
  | "edit"
  /** The menu's list navigation handles the key. */
  | "navigate"
  /** A horizontal list is entered from the input with a vertical arrow. */
  | "enter-list"
  /** The highlighted item handles the key, which opens or closes its submenu. */
  | "submenu"
  /** The highlighted item is activated. */
  | "activate"
  /** The popup closes and focus returns to where it came from. */
  | "close"
  /** The key belongs to an IME composition or leaves the popup (Tab). */
  | "ignore";

export interface MenuFilterKeyContext {
  orientation: MenuRoot.Orientation;
  rtl: boolean;
  /** Whether an item is highlighted. */
  hasActiveItem: boolean;
  /** Whether the highlighted item opens a submenu. */
  activeItemOpensSubmenu: boolean;
  /** Whether the input has text. */
  hasValue: boolean;
}

/**
 * Decides what a key does while the filter input owns the keyboard.
 */
export function getMenuFilterKeyAction(
  event: { key: string; which?: number; shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean },
  context: MenuFilterKeyContext,
): MenuFilterKeyAction {
  const { orientation, rtl, hasActiveItem, activeItemOpensSubmenu, hasValue } = context;
  const { key } = event;
  // Enter that commits an IME composition belongs to the input, not the list.
  if (event.which === 229) {
    return "ignore";
  }
  if (key === "Tab") {
    return event.shiftKey ? "close" : "ignore";
  }
  if (key === "Enter") {
    return hasActiveItem ? "activate" : "navigate";
  }

  const isArrow = key.startsWith("Arrow");
  const isBoundary = key === "Home" || key === "End";

  // Modified arrows and boundary keys are text-editing commands (extend the selection, move by
  // word or to a text boundary), like a modified character.
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
    return isArrow || isBoundary || key.length === 1 ? "edit" : "navigate";
  }
  // Characters stay out of parent handlers such as typeahead.
  if (key.length === 1) {
    return "edit";
  }
  // Home and End move the caret while the input has text, and jump to the ends of the list
  // otherwise once an item is highlighted.
  if (isBoundary) {
    return hasActiveItem && !hasValue ? "navigate" : "edit";
  }
  if (!isArrow) {
    return "navigate";
  }

  if (isMainOrientationKey(key, orientation)) {
    // Left and Right move the caret of a non-empty input while nothing is highlighted.
    return orientation === "horizontal" && !hasActiveItem && hasValue ? "edit" : "navigate";
  }

  // A highlighted submenu trigger takes the cross-axis keys to open or close its submenu.
  if (
    activeItemOpensSubmenu &&
    (isCrossOrientationOpenKey(key, orientation, rtl) || isCrossOrientationCloseKey(key, orientation, rtl, false))
  ) {
    return "submenu";
  }
  if (orientation === "horizontal" && !hasActiveItem) {
    return "enter-list";
  }
  // Otherwise the cross-axis keys move the caret. On an empty input they fall through so they
  // can still close a submenu.
  return hasValue ? "edit" : "navigate";
}

/**
 * Routes keys for a filterable menu's input, which holds real focus while the list is navigated
 * with `aria-activedescendant`. Keys reaching the input, and those an item that received real
 * focus from assistive technology hands back, go through here; the trigger relays only the
 * vertical arrows while the popup is open. Navigation runs the menu's own list navigation
 * handler directly.
 */
export function useMenuFilterKeyDown(hasValue: () => boolean) {
  const { orientation, store } = useMenuRootContext();
  const submenuContext = useMenuSubmenuRootContext();

  function navigateWithListNavigation(event: KeyboardEvent) {
    const inputProps = untrack(() => store.peek("inputProps")) as { onKeyDown?: (event: KeyboardEvent) => void };
    inputProps.onKeyDown?.(event);
  }

  return (event: KeyboardEvent) => {
    const activeItem = untrack(() => store.peek("highlightedItem")) as HTMLElement | undefined;
    const rtl = document.dir === "rtl";
    const action = getMenuFilterKeyAction(event, {
      orientation,
      rtl,
      hasActiveItem: activeItem != null,
      activeItemOpensSubmenu: activeItem?.hasAttribute("aria-haspopup") ?? false,
      hasValue: untrack(hasValue),
    });

    switch (action) {
      case "edit":
        event.stopPropagation();
        // Typing ends pointer modality, as it does in a combobox, so a result change that moves
        // the highlighted item out from under a resting pointer doesn't clear the highlight.
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          navigateWithListNavigation(event);
        }
        break;
      case "navigate": {
        if (isMainOrientationKey(event.key, orientation)) {
          // Keep the same event from reaching the popup's list navigation and moving the virtual
          // cursor a second time.
          event.stopPropagation();
        }
        navigateWithListNavigation(event);
        break;
      }
      case "enter-list": {
        event.stopPropagation();
        const listRef = store.context.itemDomElements;
        const index = event.key === "ArrowDown" ? getMinListIndex(listRef) : getMaxListIndex(listRef);
        if (listRef.current[index]) {
          event.preventDefault();
          store.setActiveIndex(index, REASONS.keyboard, event);
        }
        break;
      }
      case "submenu": {
        // The highlighted item's own handlers decide, since opening depends on the item and on
        // both menus' orientations, and they read `currentTarget`, so the key is dispatched on
        // it. Its propagation reaches the popup, which closes a submenu.
        stopEvent(event);
        const KeyboardEventConstructor = (activeItem?.ownerDocument.defaultView ?? window).KeyboardEvent;
        activeItem?.dispatchEvent(new KeyboardEventConstructor(event.type, event));
        break;
      }
      case "activate":
        event.preventDefault();
        if (activeItem) {
          dispatchClickWithModifiers(activeItem, event);
        }
        break;
      case "close": {
        // Mirror the plain menu: Shift+Tab closes the popup and returns focus. A submenu returns
        // to the element that held focus in its parent, which is the parent's input rather than
        // its untabbable trigger when the parent is filterable too.
        stopEvent(event);
        const parent = untrack(() => store.peek("parent")) as { type: "menu"; store: typeof store } | { type: undefined };
        const returnElement =
          (parent.type === "menu" && submenuContext?.getReturnElement?.()) || untrack(() => store.peek("activeTriggerElement"));
        const details = createChangeEventDetails(REASONS.focusOut, event);
        store.setOpen(false, details);
        if (!details.isCanceled && returnElement instanceof HTMLElement) {
          returnElement.focus();
        }
        break;
      }
      default:
        break;
    }
  };
}

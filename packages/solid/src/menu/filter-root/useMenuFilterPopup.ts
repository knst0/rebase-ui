import { isElement, isHTMLElement } from "@floating-ui/utils/dom";
import { createEffect, untrack } from "solid-js";

import { useFilterDropdownRootContext } from "../../filter-dropdown/root/FilterDropdownRootContext";
import { isRefocusingOwner, refocusOwner } from "../../filter-dropdown/utils/refocusOwner";
import { isCrossOrientationCloseKey } from "../../internals/floating/interactions/createListNavigation";
import { activeElement, contains, getTarget, isTypeableElement } from "../../internals/floating/utils/element";
import type { MenuRoot } from "../root/MenuRoot";

/**
 * Interaction props for a filterable menu's popup: the input owns virtual focus, so background
 * presses keep focus on it and pointer movement restores focus to it.
 */
export function useMenuFilterPopup(orientation: MenuRoot.Orientation): Record<string, unknown> {
  const context = useFilterDropdownRootContext();
  const { focusOwnerRef } = context;

  // Focus that entered a nested popup by keyboard or click stays there while the
  // pointer crosses the parent popup. Returning to a submenu trigger restores focus to the
  // parent input. Focus that merely followed the pointer in follows it back out.
  let nestedFocus: Element | null = null;
  // A tap fires compatibility mouse events, which must not focus the input and raise the
  // on-screen keyboard.
  let pointerType = "mouse";

  function trackPointerType(event: PointerEvent) {
    pointerType = event.pointerType || "mouse";
  }

  if (process.env.NODE_ENV !== "production") {
    createEffect(
      () => context.open(),
      (open) => {
        if (open && focusOwnerRef.current === null) {
          console.warn(
            "Rebase UI: A filterable menu opened without a <Menu.Input>. Render the input inside " +
              "<Menu.Popup>, or drop <Menu.FilterProvider> for a menu that does not filter.",
          );
        }
        return undefined;
      },
    );
  }

  function restoreInputFocus(event: MouseEvent & { currentTarget: HTMLElement }, enteredTrigger: boolean) {
    const focusOwner = focusOwnerRef.current;
    if (!untrack(context.open) || !focusOwner) {
      return;
    }

    const activeEl = activeElement(event.currentTarget.ownerDocument);
    if (activeEl === focusOwner || contains(event.currentTarget, activeEl)) {
      return;
    }

    // Nested popups are portalled, so their events still bubble through this component tree.
    // The composed path only contains this popup when the pointer is really over it, and a
    // closing popup must not re-capture focus during its exit transition.
    let submenuTrigger: HTMLElement | null = null;
    const nearestPopup = event.composedPath().find((node) => {
      if (!isHTMLElement(node)) {
        return false;
      }
      if (node.getAttribute("role") === "dialog" || node.hasAttribute("data-rootownerid")) {
        return true;
      }
      if (node.hasAttribute("aria-haspopup")) {
        submenuTrigger = node;
      }
      return false;
    });
    if (nearestPopup !== event.currentTarget) {
      return;
    }

    // A nested popup that took focus keeps it while the pointer moves over the parent popup.
    // Entering a submenu trigger returns focus to the parent's input.
    if (nestedFocus && !(enteredTrigger && submenuTrigger)) {
      return;
    }
    if (enteredTrigger && submenuTrigger && isElement(event.relatedTarget) && contains(submenuTrigger, event.relatedTarget)) {
      return;
    }
    refocusOwner(focusOwner);
  }

  return {
    // The input owns virtual focus.
    "aria-activedescendant": undefined,
    // Not valid on a dialog; the list's implicit orientation is already vertical.
    "aria-orientation": undefined,
    onMouseDown(event: MouseEvent & { currentTarget: HTMLElement }) {
      if (getTarget(event) === event.currentTarget) {
        // Keep focus on the virtual focus owner when the popup's own background is pressed.
        event.preventDefault();
      }
    },
    onPointerDown: trackPointerType,
    // `pointerover` precedes the compatibility `mouseover`, so a mouse entering right after a tap
    // is recognized before the handoff below.
    onPointerOver: trackPointerType,
    onPointerMove: trackPointerType,
    onMouseMove(event: MouseEvent & { currentTarget: HTMLElement }) {
      if (pointerType === "mouse") {
        restoreInputFocus(event, false);
      }
    },
    onMouseOver(event: MouseEvent & { currentTarget: HTMLElement }) {
      if (pointerType === "mouse" && nestedFocus) {
        restoreInputFocus(event, true);
      }
    },
    // `onFocusIn`: React's `onFocus` is `focusin` (bubbling); Solid's `onFocus` is native
    // `focus` (non-bubbling), which would miss descendants and nested popups.
    onFocusIn(event: FocusEvent & { currentTarget: HTMLElement }) {
      // `focusin` bubbles, so this also sees the owner itself being focused.
      const target = getTarget(event);

      // Nested popups are portalled, so their focus events bubble through this component tree
      // while their elements sit outside this one in the DOM.
      if (target === focusOwnerRef.current) {
        nestedFocus = null;
      } else if (isHTMLElement(target) && !contains(event.currentTarget, target) && !isRefocusingOwner()) {
        nestedFocus = target;
      }

      // Focus that lands on the popup itself, the focus manager's fallback target, moves on to
      // the input, which owns focus while the menu filters.
      if (untrack(context.open) && target === event.currentTarget) {
        focusOwnerRef.current?.focus({ preventScroll: true });
      }
    },
    onKeyDown(event: KeyboardEvent & { currentTarget: HTMLElement }) {
      const target = getTarget(event);
      if (target === focusOwnerRef.current || isTypeableElement(target)) {
        return;
      }

      if (isCrossOrientationCloseKey(event.key, orientation, document.dir === "rtl", false)) {
        focusOwnerRef.current?.focus({ preventScroll: true });
        // Nested popups bubble through this component tree, so keep the key from the parent.
        event.stopPropagation();
      }
    },
  };
}

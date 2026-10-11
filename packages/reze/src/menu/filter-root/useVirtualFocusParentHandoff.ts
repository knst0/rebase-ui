import { effect, untrack } from "reze-js";

import { REASONS } from "../../internals/event-details";
import { contains } from "../../internals/floating/utils/element";
import type { MenuRoot } from "../root/MenuRoot";
import type { MenuParent, MenuStore } from "../store/MenuStore";
import type { MenuFilterParentHandoff } from "./MenuFilterContext";

/**
 * A plain submenu whose parent is filterable. The parent keeps real focus on its input, so its
 * trigger never blurs and its return focus waits for this popup's exit animation. The submenu
 * hands focus and the parent's highlight back itself.
 */
export function useVirtualFocusParentHandoff(
  store: MenuStore<unknown>,
  parent: MenuParent,
  open: () => boolean,
  virtualFocus: boolean,
): MenuFilterParentHandoff {
  const parentStore = parent.type === "menu" ? parent.store : null;
  const parentVirtualFocusRef = parentStore?.context.virtualFocusRef;

  function returnToParent(trigger: Element | null, reason: MenuRoot.ChangeEventReason | null) {
    const focusOwner = parentVirtualFocusRef?.current;
    if (virtualFocus || untrack(() => store.peek("open")) || !parentStore || !untrack(() => parentStore.peek("open")) || !focusOwner) {
      return;
    }

    const popupElement = store.context.popupRef.current;
    const activeEl = popupElement?.ownerDocument.activeElement ?? null;
    if (popupElement && activeEl && contains(popupElement, activeEl)) {
      focusOwner.focus({ preventScroll: true });
    }

    if ((reason === REASONS.listNavigation || reason === REASONS.escapeKey) && untrack(() => parentStore.peek("activeIndex")) == null) {
      // The closing key is gone by this microtask, so there is no event to report it with.
      parentStore.highlightItem(trigger, REASONS.none);
    }
  }

  effect(() => {
    const isOpen = open();
    // One-shot handoff: the value only steers this write.
    untrack(() => {
      if (!isOpen) {
        // A parent closing in the same commit, such as on an item press, syncs its controlled `open`
        // in its own effect, which runs after this one. An unmount can clear the trigger by
        // then, so read it now.
        const trigger = store.peek("activeTriggerElement") as Element | null;
        const reason = store.peek("lastOpenChangeReason") as MenuRoot.ChangeEventReason | null;
        queueMicrotask(() => returnToParent(trigger, reason));
      }
    });
  });

  // Real focus entering this submenu is when a plain parent's trigger would blur: the parent has
  // no active item until a keyboard close hands the cursor back to the trigger.
  function handleFocus() {
    if (!virtualFocus && parentVirtualFocusRef && parentStore && untrack(() => parentStore.peek("activeIndex")) != null) {
      parentStore.setActiveIndex(null);
    }
  }

  return { parentVirtualFocusRef, handleFocus };
}

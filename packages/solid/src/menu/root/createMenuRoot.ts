import { createEffect, createUniqueId, onCleanup, untrack } from "solid-js";

import { EMPTY_ARRAY } from "#utils/empty";

import { REASONS } from "../../internals/event-details";
import { createDismiss } from "../../internals/floating/interactions/createDismiss";
import { Timeout } from "../../internals/floating/interactions/createHoverInteractionSharedState";
import { createListNavigation } from "../../internals/floating/interactions/createListNavigation";
import { createTypeahead } from "../../internals/floating/interactions/createTypeahead";
import { useFloatingNodeId, useFloatingParentNodeId } from "../../internals/floating/tree/FloatingTree";
import { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import {
  attachPreventUnmountOnClose,
  createPopupOpenState,
  FOCUSABLE_POPUP_PROPS,
  getRootFloatingContext,
  trackImplicitActiveTrigger,
  trackOpenStateTransitions,
} from "../../internals/popups/popupStoreUtils";
import { stableCallback } from "../../internals/stableCallback";
import { MenuStore, type MenuInteractionType, type MenuParent } from "../store/MenuStore";
import { useMenuSubmenuRootContext } from "../submenu-root/MenuSubmenuRootContext";
import type { MenuRoot } from "./MenuRoot";

export interface CreateMenuRootParameters {
  open: () => boolean | undefined;
  defaultOpen: () => boolean;
  disabled: () => boolean;
  modal: () => boolean | undefined;
  loopFocus: () => boolean;
  orientation: () => MenuRoot.Orientation;
  highlightItemOnHover: () => boolean;
  closeParentOnEsc: () => boolean;
  triggerId: () => string | null | undefined;
  onOpenChange: (open: boolean, eventDetails: MenuRoot.ChangeEventDetails) => void;
  onOpenChangeComplete: (open: boolean) => void;
}

export interface CreateMenuRootReturnValue<Payload> {
  store: MenuStore<Payload>;
  parent: MenuParent;
  floatingTreeRoot: FloatingTreeStore;
  open: () => boolean;
  mounted: () => boolean;
  forceUnmount: () => void;
}

export function createMenuRoot<Payload>(parameters: CreateMenuRootParameters): CreateMenuRootReturnValue<Payload> {
  const submenuContext = useMenuSubmenuRootContext();
  const parent: MenuParent =
    submenuContext !== undefined ? { type: "menu", store: submenuContext.parentMenu as MenuStore<unknown> } : { type: undefined };

  const floatingTreeRoot = parent.type === "menu" ? (parent.store.peek("floatingTreeRoot") as FloatingTreeStore) : new FloatingTreeStore();

  const floatingId = createUniqueId();
  const rootId = createUniqueId();
  const floatingNodeId = useFloatingNodeId(floatingTreeRoot);
  const floatingParentNodeIdFromContext = useFloatingParentNodeId();
  const nested = floatingParentNodeIdFromContext != null;

  // An initially open submenu seeds `instantType` from a parent that is playing its own enter
  // transition so `[data-instant]` styling suppresses the enter transition on both popups or
  // neither. Read once: only meaningful during the first render.
  const seededInstantType = untrack(
    () =>
      ((parameters.open() ?? parameters.defaultOpen())
        ? parent.type === "menu" && parent.store.peek("transitionStatus") === "starting"
          ? (parent.store.peek("instantType") as "dismiss" | "click" | "group" | "trigger-change" | undefined)
          : undefined
        : undefined) as "dismiss" | "click" | "group" | "trigger-change" | undefined,
  );

  const store = new MenuStore<Payload>(
    {
      open: untrack(parameters.defaultOpen),
      openProp: untrack(parameters.open),
      triggerIdProp: untrack(parameters.triggerId),
      parent,
      disabled: untrack(parameters.disabled),
      highlightItemOnHover: untrack(parameters.highlightItemOnHover),
      modal: parent.type === undefined ? untrack(parameters.modal) : undefined,
      rootId,
      floatingTreeRoot,
      instantType: seededInstantType,
    },
    floatingId,
    nested,
  );

  store.useSyncedValue("openProp", parameters.open);
  store.useSyncedValue("triggerIdProp", parameters.triggerId);

  const onOpenChange = stableCallback(() => parameters.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => parameters.onOpenChangeComplete);
  store.context.onOpenChange = onOpenChange;
  store.context.onOpenChangeComplete = onOpenChangeComplete;

  const open = () => store.select("open") as boolean;
  const mounted = () => store.select("mounted") as boolean;

  const allowTouchToCloseTimeout = new Timeout();
  onCleanup(() => allowTouchToCloseTimeout.clear());
  const allowTouchToCloseRef = { current: true };

  function setOpen(nextOpen: boolean, eventDetails: Omit<MenuRoot.ChangeEventDetails, "preventUnmountOnClose">) {
    const reason = eventDetails.reason;

    // One-shot snapshot reads: relayed tree events and stale hover timers can request a close
    // after the state changed but before computations re-ran.
    if (!nextOpen && !store.peek("open")) {
      return;
    }

    const isOpen = store.peek("open") as boolean;
    const activeTriggerElement = store.peek("activeTriggerElement") as Element | null;
    const lastOpenChangeReason = store.peek("lastOpenChangeReason") as MenuRoot.ChangeEventReason | null;
    if (isOpen === nextOpen && eventDetails.trigger === activeTriggerElement && lastOpenChangeReason === reason) {
      return;
    }

    const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(eventDetails as MenuRoot.ChangeEventDetails);

    // Do not immediately reset the activeTriggerId to allow
    // exit animations to play and focus to be returned correctly.
    if (!nextOpen && eventDetails.trigger == null) {
      (eventDetails as { trigger?: Element | undefined }).trigger = activeTriggerElement ?? undefined;
    }

    onOpenChange(nextOpen, eventDetails as MenuRoot.ChangeEventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    const snapshot = store.peekState();
    snapshot.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails as MenuRoot.ChangeEventDetails);

    const nativeEvent = eventDetails.event as Event | undefined;
    if (
      nextOpen === false &&
      nativeEvent?.type === "click" &&
      (nativeEvent as PointerEvent).pointerType === "touch" &&
      !allowTouchToCloseRef.current
    ) {
      return;
    }

    // Prevent the menu from closing on mobile devices that have a delayed click event.
    if (nextOpen && reason === REASONS.triggerFocus) {
      allowTouchToCloseRef.current = false;
      allowTouchToCloseTimeout.start(300, () => {
        allowTouchToCloseRef.current = true;
      });
    } else {
      allowTouchToCloseRef.current = true;
      allowTouchToCloseTimeout.clear();
    }

    // Keyboard and assistive-technology activations produce `detail === 0` clicks;
    // mouse-gesture clicks carry `detail >= 1`.
    const isKeyboardClick = (reason === REASONS.triggerPress || reason === REASONS.itemPress) && (nativeEvent as MouseEvent).detail === 0;
    const isDismissClose = !nextOpen && (reason === REASONS.escapeKey || reason == null);

    const popupOpenState = createPopupOpenState(
      snapshot,
      nextOpen,
      (eventDetails as { trigger?: Element | undefined }).trigger as Element | undefined,
      shouldPreventUnmountOnClose(),
    ) as ReturnType<typeof createPopupOpenState> & {
      openChangeReason: MenuRoot.ChangeEventReason;
      instantType: "dismiss" | "click" | "group" | "trigger-change" | undefined;
    };

    popupOpenState.openChangeReason = reason as MenuRoot.ChangeEventReason;

    if (isKeyboardClick || isDismissClose) {
      popupOpenState.instantType = isKeyboardClick ? "click" : "dismiss";
    } else {
      popupOpenState.instantType = undefined;
    }

    store.update(popupOpenState);
  }

  const floatingRootContext = store.peekState().floatingRootContext;

  // Assigned synchronously so interaction-driven `setOpen` calls in the same commit are received;
  // refreshed by the sync effect below to stay fresh.
  floatingRootContext.context.onOpenChange = (nextOpen, eventDetails) => {
    setOpen(nextOpen, eventDetails as MenuRoot.ChangeEventDetails);
  };

  // Registered synchronously (not in an effect) so `setOpen` emits from imperative
  // `MenuHandle.open()` calls made in the same commit this root mounts are received
  // instead of being silently dropped.
  const handleSetOpenEvent = ({ open: nextOpen, eventDetails }: { open: boolean; eventDetails: MenuRoot.ChangeEventDetails }) =>
    setOpen(nextOpen, eventDetails);
  floatingRootContext.context.events.on("setOpen", handleSetOpenEvent);
  onCleanup(() => {
    floatingRootContext.context.events.off("setOpen", handleSetOpenEvent);
  });

  // Keep the floating context's open state and elements in sync with the store.
  // Mirrors `useSyncedFloatingRootContext` without taking over open-change ownership:
  // the menu relays open changes through the `setOpen` event above.
  store.useSyncedValue("floatingId", () => floatingId);
  createEffect(
    () => ({
      isOpen: open(),
      referenceElement: store.select("activeTriggerElement") as Element | null,
      floatingElement: store.select("positionerElement") as HTMLElement | null,
    }),
    ({ isOpen, referenceElement, floatingElement }) => {
      floatingRootContext.update({
        open: isOpen,
        floatingId,
        referenceElement,
        domReferenceElement: referenceElement,
        floatingElement,
      });
      // Keep non-reactive context values fresh for interactions that call `setOpen`.
      floatingRootContext.context.onOpenChange = (nextOpen, eventDetails) => {
        setOpen(nextOpen, eventDetails as MenuRoot.ChangeEventDetails);
      };
      floatingRootContext.context.nested = nested;
      return undefined;
    },
  );

  store.useSyncedValues(() => ({
    disabled: parameters.disabled(),
    highlightItemOnHover: parameters.highlightItemOnHover(),
    modal: parent.type === undefined ? parameters.modal() : undefined,
    rootId,
  }));

  // A submenu always supplies its own tree IDs, synchronously: the positioner's `FloatingNode`
  // reads the id once (untracked) when it renders, so an effect would come too late.
  if (submenuContext !== undefined) {
    store.update({
      floatingNodeId,
      floatingParentNodeId: floatingParentNodeIdFromContext,
    });
  }

  // Without an active trigger, the root supplies its own tree IDs.
  // A trigger can register after render, before this effect runs, so read the store here.
  createEffect(
    () => store.select("activeTriggerElement") as Element | null,
    (activeTriggerElement) => {
      if (submenuContext !== undefined || !activeTriggerElement) {
        store.update({
          floatingNodeId,
          floatingParentNodeId: floatingParentNodeIdFromContext,
        });
      }
      return undefined;
    },
  );

  trackImplicitActiveTrigger(store);
  const { forceUnmount } = trackOpenStateTransitions(open, store, () => {
    store.set("allowMouseEnter", false);
  });

  // A later controlled `open` flip bypasses `setOpen`, so a seeded `instantType` would never be
  // replaced and `[data-instant]` would wrongly suppress every subsequent transition. Clear it
  // once the enter phase settles (or closing starts).
  if (seededInstantType !== undefined) {
    createEffect(
      () => ({ isOpen: open(), transitionStatus: store.select("transitionStatus") as string | undefined }),
      ({ isOpen, transitionStatus }) => {
        if ((!isOpen || transitionStatus === undefined) && store.peek("instantType") === seededInstantType) {
          store.set("instantType", undefined);
        }
        return undefined;
      },
    );
  }

  // Re-enable hover handling once the menu is effectively closed.
  createEffect(
    () => ({ isOpen: open(), hoverEnabled: store.select("hoverEnabled") as boolean }),
    ({ isOpen, hoverEnabled }) => {
      if (!isOpen && !hoverEnabled) {
        store.set("hoverEnabled", true);
      }
      return undefined;
    },
  );

  // Records the interaction type that opened the menu. Runs before the click
  // interaction so it still observes the closed state for keyboard presses.
  let lastPointerDownType: MenuInteractionType = "";
  function recordOpenMethod(type: MenuInteractionType) {
    if (!store.peek("open")) {
      store.set("openMethod", type);
    }
  }
  function handlePointerDown(event: PointerEvent) {
    if (event.defaultPrevented) {
      return;
    }
    lastPointerDownType = (event.pointerType || "") as MenuInteractionType;
    recordOpenMethod(lastPointerDownType);
  }
  function handleClick(event: MouseEvent) {
    if (event.detail === 0) {
      recordOpenMethod("keyboard");
      return;
    }
    if ("pointerType" in event) {
      recordOpenMethod((event as PointerEvent).pointerType as MenuInteractionType);
    } else {
      recordOpenMethod(lastPointerDownType);
    }
    lastPointerDownType = "";
  }
  const openMethodProps = {
    onClick: handleClick,
    onPointerDown: handlePointerDown,
  };

  // Resets the recorded open interaction once the menu is effectively closed.
  createEffect(
    () => open(),
    (isOpen) => {
      if (!isOpen && store.peek("openMethod") !== null) {
        store.set("openMethod", null);
      }
      return undefined;
    },
  );

  const setupDisabled = untrack(parameters.disabled);
  const floatingContext = getRootFloatingContext(floatingRootContext);

  const dismiss = createDismiss(floatingContext, {
    enabled: !setupDisabled,
    bubbles: { escapeKey: untrack(parameters.closeParentOnEsc) && parent.type === "menu" },
    externalTree: nested ? floatingTreeRoot : undefined,
  });

  function setActiveIndex(index: number | null) {
    if (store.peek("activeIndex") === index) {
      return;
    }
    store.set("activeIndex", index);
  }

  const listNavigation = createListNavigation(floatingContext, {
    enabled: !setupDisabled,
    listRef: store.context.itemDomElements,
    activeIndex: () => store.select("activeIndex") as number | null,
    nested: parent.type !== undefined,
    loopFocus: untrack(parameters.loopFocus),
    orientation: untrack(parameters.orientation),
    rtl: false,
    disabledIndices: EMPTY_ARRAY as Array<number>,
    onNavigate: setActiveIndex,
    openOnArrowKeyDown: true,
    focusItemOnHover: untrack(parameters.highlightItemOnHover),
  });

  const typeahead = createTypeahead(floatingContext, {
    enabled: !setupDisabled,
    listRef: store.context.itemLabels,
    elementsRef: store.context.itemDomElements,
    activeIndex: () => store.select("activeIndex") as number | null,
    onMatch: (index) => {
      if (store.peek("open") && index !== (store.peek("activeIndex") as number | null)) {
        store.set("activeIndex", index);
      }
    },
    onTyping: (nextTyping) => {
      store.context.typingRef.current = nextTyping;
    },
  });

  const itemProps = { ...listNavigation.item() };

  function getActiveTriggerProps(): Record<string, unknown> {
    return mergeInteractionProps(
      { ...typeahead.reference() },
      { ...listNavigation.reference() },
      { ...dismiss.reference() },
      {
        onMouseMove() {
          store.set("allowMouseEnter", true);
        },
      },
      openMethodProps,
      {
        "aria-haspopup": "menu" as const,
        "aria-expanded": store.select("open") as boolean,
      },
    );
  }

  function getInactiveTriggerProps(): Record<string, unknown> {
    return mergeInteractionProps({ ...listNavigation.trigger() }, { ...dismiss.reference() }, openMethodProps, {
      "aria-haspopup": "menu" as const,
      "aria-expanded": false,
    });
  }

  function getPopupProps(): Record<string, unknown> {
    const activeTriggerElement = store.select("activeTriggerElement") as Element | null;
    return mergeInteractionProps(
      { ...FOCUSABLE_POPUP_PROPS },
      {
        id: floatingId,
        role: "menu" as const,
        // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
        "aria-orientation": untrack(parameters.orientation) === "horizontal" ? "horizontal" : undefined,
        "aria-labelledby": activeTriggerElement?.id ?? undefined,
        onMouseMove() {
          store.set("allowMouseEnter", true);
          if (parent.type === "menu") {
            store.set("hoverEnabled", false);
          }
        },
        onClick() {
          if (store.peek("hoverEnabled")) {
            store.set("hoverEnabled", false);
          }
        },
        onKeyDown(event: KeyboardEvent) {
          const relay = store.peek("keyboardEventRelay") as ((event: KeyboardEvent) => void) | undefined;
          if (relay && !event.defaultPrevented) {
            relay(event);
          }
        },
      },
      { ...typeahead.floating() },
      { ...listNavigation.floating() },
      { ...dismiss.floating() },
    );
  }

  store.useSyncedValues(() => ({
    activeTriggerProps: getActiveTriggerProps(),
    inactiveTriggerProps: getInactiveTriggerProps(),
    popupProps: getPopupProps(),
    itemProps,
  }));

  return { store, parent, floatingTreeRoot, open, mounted, forceUnmount };
}

/**
 * Merges interaction prop objects, chaining event handlers in order.
 */
function mergeInteractionProps(...sources: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) {
      continue;
    }
    for (const key of Object.keys(source)) {
      const propValue = source[key];
      const existing = merged[key];
      if (typeof propValue === "function" && key.startsWith("on") && typeof existing === "function") {
        const first = existing as (...args: Array<any>) => void;
        const second = propValue as (...args: Array<any>) => void;
        merged[key] = (...args: Array<any>) => {
          first(...args);
          second(...args);
        };
      } else {
        merged[key] = propValue;
      }
    }
  }
  return merged;
}

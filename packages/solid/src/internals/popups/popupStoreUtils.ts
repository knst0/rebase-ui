import type { JSX } from "@solidjs/web";
import { type Accessor, createEffect, createUniqueId, onCleanup, onSettled, untrack } from "solid-js";
import { flush } from "solid-js";

import { createChangeEventDetails, type RebaseUIChangeEventDetails } from "../event-details/createEventDetails";
import { REASONS } from "../event-details/reasons";
import type { FloatingRootStore } from "../floating/tree/FloatingRootStore";
import { useFloatingParentNodeId } from "../floating/tree/FloatingTree";
import type { FloatingContext, Placement, Strategy } from "../floating/types";
import { useSyncedFloatingRootContext } from "../floating/useSyncedFloatingRootContext";
import { FOCUSABLE_ATTRIBUTE } from "../floating/utils/constants";
import { runOnOpenChangeComplete } from "../runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../transition-status";
import type { PopupStoreContext, PopupStoreState } from "./popupStoreState";

export const FOCUSABLE_POPUP_PROPS = {
  tabindex: -1,
  [FOCUSABLE_ATTRIBUTE]: "",
} satisfies Record<string, string | number>;

/**
 * Structural view of a popup store for registration, data forwarding, and open-state
 * plumbing. Intentionally `any`-based: concrete stores type their accessors over narrower
 * selector keys, which are not assignable to `string`-keyed signatures, while `any`-keyed
 * signatures accept them. Runtime behavior is unchanged (selectors still dispatch by key).
 */
export interface PopupStoreLike {
  readonly context: PopupStoreContext<any>;
  readonly state: any;
  select(key: any, arg?: any): any;
  set(key: any, value: any): void;
  update(changes: any): void;
  useState(key: any, arg?: any): Accessor<any>;
  useSyncedValue(key: any, getValue: () => any): void;
  useSyncedValues(getValues: () => any): void;
}

export type PayloadChildRenderFunction<Payload> = (args: { payload: Payload | undefined }) => JSX.Element;

/**
 * Creates and owns a popup store on behalf of a Root part. The store is created exactly once, with
 * controlled props and root state synced separately after creation. Sets up the synced floating
 * root context and returns the store.
 */
export function createPopupRootStore<Store extends PopupStoreLike & { setOpen(open: boolean, eventDetails: any): void }>(
  createStore: (floatingId: string | undefined, nested: boolean) => Store,
  treatPopupAsFloatingElement = false,
): Store {
  const floatingId = createUniqueId();
  const nested = useFloatingParentNodeId() != null;

  let store: Store | undefined;
  const getStore = () => {
    store ??= createStore(floatingId, nested);
    return store;
  };

  useSyncedFloatingRootContext({
    popupStore: getStore(),
    treatPopupAsFloatingElement,
    floatingRootContext: untrack(() => getStore().select("floatingRootContext")),
    floatingId,
    nested,
    onOpenChange: (open, eventDetails) => {
      getStore().setOpen(open, eventDetails);
    },
  });

  return getStore();
}

export interface PopupRootStoreHandle<Store> {
  attachStore(store: Store): () => void;
}

/**
 * Attaches a Root's store to a handle for the component's committed lifetime so descendants can
 * call the handle during the Root's initial commit. Attaching writes to state owned by the handle,
 * so it happens outside the component's owned scope once rendering has settled.
 */
export function attachPopupHandle<Store>(handle: PopupRootStoreHandle<Store> | undefined, store: Store): void {
  if (!handle) {
    return;
  }

  onSettled(() => {
    return handle.attachStore(store);
  });
}

function syncTriggerCount(store: PopupStoreLike) {
  const triggerCount = store.context.triggerElements.size;
  if (untrack(() => store.select("open")) && untrack(() => store.state.triggerCount) !== triggerCount) {
    store.set("triggerCount", triggerCount);
  }
}

/**
 * Registers/unregisters a trigger element in the store, migrating the registration when the
 * store or id changes (e.g. a detached trigger following its handle to the live root store).
 */
export function trackTriggerRegistration(options: {
  id: string | undefined;
  store: () => PopupStoreLike | undefined;
  element: () => Element | null;
}): void {
  createEffect(
    () => ({ store: options.store(), id: options.id, element: options.element() }),
    ({ store, id, element }) => {
      if (!store || id === undefined || element === null) {
        return undefined;
      }

      store.context.triggerElements.add(id, element);
      syncTriggerCount(store);

      return () => {
        if (store.context.triggerElements.getById(id) === element) {
          store.context.triggerElements.delete(id);
          syncTriggerCount(store);
        }
      };
    },
  );
}

type PopupOpenState = Pick<
  PopupStoreState<unknown>,
  "open" | "preventUnmountingOnClose" | "activeTriggerId" | "activeTriggerElement" | "openedWithoutTrigger"
>;

export function createPopupOpenState(
  state: PopupOpenState,
  open: boolean,
  trigger: Element | undefined,
  preventUnmountOnClose = false,
): PopupOpenState {
  let preventUnmountingOnClose = state.preventUnmountingOnClose;
  if (open) {
    // Opening starts a new close cycle, so clear any previous request to keep the popup mounted.
    preventUnmountingOnClose = false;
  } else if (preventUnmountOnClose) {
    preventUnmountingOnClose = true;
  }

  const triggerId = trigger?.id ?? null;
  let activeTriggerId = state.activeTriggerId;
  let activeTriggerElement = state.activeTriggerElement;

  // If a popup is closing, the `trigger` may be undefined.
  // We want to keep the previous value so that exit animations are played and focus is returned correctly.
  if (triggerId || open) {
    activeTriggerId = triggerId;
    activeTriggerElement = trigger ?? null;
  }

  return {
    open,
    preventUnmountingOnClose,
    activeTriggerId,
    activeTriggerElement,
    // An open request without a trigger (a handle's `open(null)` or `openWithPayload()`) must not
    // be reassociated with a lone registered trigger later on. Controlled and default opens never
    // pass through here, so they keep claiming a lone trigger. A close request keeps the flag: a
    // controlled root may decline it and stay open, so the Root clears the flag only once the
    // popup is effectively closed.
    openedWithoutTrigger: open ? trigger == null : state.openedWithoutTrigger,
  };
}

export function attachPreventUnmountOnClose(eventDetails: { preventUnmountOnClose(): void }) {
  let preventUnmountOnClose = false;

  eventDetails.preventUnmountOnClose = () => {
    preventUnmountOnClose = true;
  };

  return () => preventUnmountOnClose;
}

/**
 * Runs the shared open-change sequence for a popup store: notifies `onOpenChange`,
 * honors cancellation, dispatches the floating root change, maps the reason to an
 * `instantType`, and commits the state update (synchronously for hover so
 * `getAnimations()` observes it).
 */
export function applyPopupOpenChange<
  State extends PopupStoreState<unknown> & {
    instantType?: "delay" | "dismiss" | "focus" | undefined;
  },
  EventDetails extends RebaseUIChangeEventDetails<string>,
  ExtraKey extends keyof State = never,
>(
  store: PopupStoreLike,
  nextOpen: boolean,
  eventDetails: EventDetails & { preventUnmountOnClose(): void },
  options: {
    onBeforeDispatch?: (() => void) | undefined;
    extraState?: Pick<State, ExtraKey> | undefined;
  } = {},
): void {
  const reason = eventDetails.reason;
  const isHover = reason === REASONS.triggerHover;
  const isFocusOpen = nextOpen && reason === REASONS.triggerFocus;
  const isDismissClose = !nextOpen && (reason === REASONS.triggerPress || reason === REASONS.escapeKey);

  const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(eventDetails);

  store.context.onOpenChange?.(nextOpen, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  options.onBeforeDispatch?.();

  // One-shot snapshot read: the surrounding effect computes already subscribe to the
  // values they need, and event handlers don't track.
  const snapshot = untrack(() => store.state);

  snapshot.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);

  const changeState = () => {
    const popupOpenState = createPopupOpenState(
      snapshot,
      nextOpen,
      eventDetails.trigger as Element | undefined,
      shouldPreventUnmountOnClose(),
    );

    const updatedState = { ...options.extraState, ...popupOpenState } as Pick<State, keyof PopupOpenState | ExtraKey | "instantType">;

    if (isFocusOpen) {
      updatedState.instantType = "focus";
    } else if (isDismissClose) {
      updatedState.instantType = "dismiss";
    } else if (isHover) {
      updatedState.instantType = undefined;
    }

    store.update(updatedState);
  };

  if (isHover) {
    // Commit synchronously for hover so `node.getAnimations()` sees the new state.
    changeState();
    flush();
  } else {
    changeState();
  }
}

/**
 * Sets up trigger data forwarding to the store: registers the trigger element and applies
 * trigger-owned state (active-trigger ownership and payload) when this trigger is active.
 */
export function setupTrigger(options: {
  triggerId: string | undefined;
  triggerElement: () => Element | null;
  store: () => PopupStoreLike | undefined;
  stateUpdates: () => Record<string, any>;
}): { isMountedByTrigger: () => boolean } {
  const { triggerId } = options;

  trackTriggerRegistration({ id: triggerId, store: options.store, element: options.triggerElement });

  const isMountedByTrigger = () => {
    const store = options.store();
    return store ? ((store.select("isMountedByTrigger", triggerId) as boolean) ?? false) : false;
  };

  function applyTriggerData(store: PopupStoreLike, element: Element) {
    const open = untrack(() => store.select("open")) as boolean;
    const activeTriggerId = untrack(() => store.select("activeTriggerId")) as string | null;
    const stateUpdates = untrack(options.stateUpdates);

    if (activeTriggerId === triggerId) {
      store.update({
        activeTriggerElement: element,
        ...(open ? stateUpdates : null),
      });
      return;
    }

    if (activeTriggerId == null && open && !untrack(() => store.state.openedWithoutTrigger)) {
      // If a popup is already open, a detached trigger can mount before any active trigger
      // has been established. Claim the first registered trigger so trigger-owned focus
      // management and ARIA relationships work. A popup opened deliberately without a trigger
      // stays unassociated so the trigger's `payload` does not replace the programmatic one.
      store.update({
        activeTriggerId: triggerId ?? null,
        activeTriggerElement: element,
        ...stateUpdates,
      });
    }
  }

  // Applies trigger-owned state when the trigger (re)registers into a store.
  createEffect(
    () => ({ store: options.store(), element: options.triggerElement() }),
    ({ store, element }) => {
      if (store && element && triggerId !== undefined) {
        applyTriggerData(store, element);
      }
      return undefined;
    },
  );

  createEffect(
    () => ({ mounted: isMountedByTrigger(), store: options.store(), element: options.triggerElement(), updates: options.stateUpdates() }),
    ({ mounted, store, element, updates }) => {
      if (mounted && store) {
        store.update({ activeTriggerElement: element, ...updates });
      }
      return undefined;
    },
  );

  return { isMountedByTrigger };
}

/**
 * Keeps trigger registration state synchronized while the popup is open.
 * When a popup opens without an explicit trigger id and exactly one trigger is registered, that
 * trigger is claimed as the active trigger, unless the open request deliberately carried no trigger
 * (`openedWithoutTrigger`). If `closeOnActiveTriggerUnmount` is enabled, unregistering a previously
 * resolved active trigger requests a close after a microtask so a same-tick replacement trigger
 * with the same id can register first. Should be called on the Root part.
 */
export function trackImplicitActiveTrigger(
  store: PopupStoreLike & {
    setOpen(open: boolean, eventDetails: any): void;
  },
  options: {
    closeOnActiveTriggerUnmount?: boolean | undefined;
  } = {},
): void {
  const { closeOnActiveTriggerUnmount = false } = options;
  // Distinguishes a trigger that unmounted from a new active trigger that has not hydrated yet.
  let resolvedActiveTriggerId: string | null = null;

  createEffect(
    () => ({
      open: store.select("open"),
      triggerCount: store.select("triggerCount"),
      activeTriggerId: store.select("activeTriggerId"),
      activeTriggerElement: store.select("activeTriggerElement"),
    }),
    ({ open, triggerCount, activeTriggerId, activeTriggerElement }) => {
      // `triggerCount`, `activeTriggerId` and `activeTriggerElement` are subscriptions only:
      // the reconciliation below reads authoritative values from the snapshot.
      void triggerCount;
      void activeTriggerId;
      void activeTriggerElement;

      if (!open) {
        resolvedActiveTriggerId = null;
        if (untrack(() => store.state.triggerCount) !== 0) {
          store.set("triggerCount", 0);
        }
        // The flag is cleared only here, once the popup is effectively closed: a controlled root may
        // decline a close request and stay open, and a controlled close never reaches
        // `createPopupOpenState` at all.
        if (untrack(() => store.state.openedWithoutTrigger)) {
          store.set("openedWithoutTrigger", false);
        }
        return undefined;
      }

      const registryCount = store.context.triggerElements.size;
      const stateUpdates: Record<string, any> = {};

      if (untrack(() => store.state.triggerCount) !== registryCount) {
        stateUpdates.triggerCount = registryCount;
      }

      const currentActiveTriggerId = untrack(() => store.select("activeTriggerId")) as string | null;
      let lostActiveTriggerId: string | null = null;

      if (currentActiveTriggerId) {
        const registeredActiveTriggerElement = store.context.triggerElements.getById(currentActiveTriggerId);
        if (!registeredActiveTriggerElement) {
          let reassociated = false;
          for (const [triggerId, triggerElement] of store.context.triggerElements.entries()) {
            if (triggerElement === untrack(() => store.state.activeTriggerElement)) {
              stateUpdates.activeTriggerId = triggerId;
              stateUpdates.activeTriggerElement = triggerElement;
              resolvedActiveTriggerId = triggerId;
              reassociated = true;
              break;
            }
          }

          if (!reassociated) {
            if (resolvedActiveTriggerId === currentActiveTriggerId) {
              lostActiveTriggerId = currentActiveTriggerId;
            } else {
              resolvedActiveTriggerId = null;
            }
          }
        } else {
          resolvedActiveTriggerId = currentActiveTriggerId;
          if (registeredActiveTriggerElement !== untrack(() => store.state.activeTriggerElement)) {
            stateUpdates.activeTriggerElement = registeredActiveTriggerElement;
          }
        }
      } else {
        resolvedActiveTriggerId = null;
      }

      if (!lostActiveTriggerId && !currentActiveTriggerId && !untrack(() => store.state.openedWithoutTrigger) && registryCount === 1) {
        const iteratorResult = store.context.triggerElements.entries().next();
        if (!iteratorResult.done) {
          const [implicitTriggerId, implicitTriggerElement] = iteratorResult.value;
          stateUpdates.activeTriggerId = implicitTriggerId;
          stateUpdates.activeTriggerElement = implicitTriggerElement;
          resolvedActiveTriggerId = implicitTriggerId;
        }
      }

      if (
        stateUpdates.triggerCount !== undefined ||
        stateUpdates.activeTriggerId !== undefined ||
        stateUpdates.activeTriggerElement !== undefined
      ) {
        store.update(stateUpdates);
      }

      if (lostActiveTriggerId && closeOnActiveTriggerUnmount) {
        const lostId = lostActiveTriggerId;
        // Defer so a same-tick replacement trigger with the same id can register first.
        queueMicrotask(() => {
          if (
            untrack(() => store.select("open")) &&
            untrack(() => store.select("activeTriggerId")) === lostId &&
            !store.context.triggerElements.getById(lostId)
          ) {
            const eventDetails = createChangeEventDetails(REASONS.none);
            store.setOpen(false, eventDetails);
            // If closing is canceled, keep the previous active trigger ownership for the
            // still-open popup instead of claiming another trigger implicitly.
            if (!eventDetails.isCanceled) {
              store.update({
                activeTriggerId: null,
                activeTriggerElement: null,
              });
            }
          }
        });
      }

      return undefined;
    },
  );
}

/**
 * Manages the mounted state of the popup: sets up the transition status listeners and handles
 * unmounting when needed. Updates the `mounted`, `transitionStatus`, and
 * `preventUnmountingOnClose` states in the store.
 *
 * @returns A function to forcibly unmount the popup, alongside the transition status.
 */
export function trackOpenStateTransitions(
  open: () => boolean,
  store: PopupStoreLike,
  onUnmount?: () => void,
): { forceUnmount: () => void; transitionStatus: () => TransitionStatus } {
  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open, {
    // Hold the "starting" status until the popup element has mounted: portal
    // rendering and subtree replacement can mount it after the blind frame,
    // which would otherwise drop the enter transition entirely.
    ready: () => store.select("popupElement") != null,
  });

  store.useSyncedValue("mounted", mounted);
  store.useSyncedValue("transitionStatus", transitionStatus);

  const getPreventUnmountingOnClose = () => (open() ? false : untrack(() => store.select("preventUnmountingOnClose")));

  createEffect(
    () => getPreventUnmountingOnClose(),
    (preventUnmountingOnClose) => {
      store.set("preventUnmountingOnClose", preventUnmountingOnClose);
    },
  );

  function forceUnmount() {
    setMounted(false);
    store.update({
      activeTriggerId: null,
      activeTriggerElement: null,
      mounted: false,
      preventUnmountingOnClose: false,
    });
    onUnmount?.();
    store.context.onOpenChangeComplete?.(false);
  }

  runOnOpenChangeComplete({
    enabled: () => untrack(mounted) && !untrack(open) && !untrack(getPreventUnmountingOnClose),
    open,
    ref: () => store.context.popupRef.current,
    onComplete: () => {
      if (!open()) {
        forceUnmount();
      }
    },
  });

  return { forceUnmount, transitionStatus };
}

/**
 * Builds the minimal `FloatingContext` view over a `FloatingRootStore` for interaction creators.
 * Used where no positioned floating element exists yet (the root and triggers): the creators
 * only consume `context.rootStore` alongside its live event emitter and data ref.
 */
export function getRootFloatingContext(floatingRootContext: FloatingRootStore): FloatingContext {
  return {
    get x() {
      return 0;
    },
    get y() {
      return 0;
    },
    get placement(): Placement {
      return "bottom";
    },
    get strategy(): Strategy {
      return "absolute";
    },
    get middlewareData() {
      return {};
    },
    get isPositioned() {
      return false;
    },
    get floatingStyles(): { position: Strategy; top: number; left: number } {
      return { position: "absolute", top: 0, left: 0 };
    },
    update() {},
    get open() {
      return floatingRootContext.select("open");
    },
    onOpenChange: (open, eventDetails) => floatingRootContext.setOpen(open, eventDetails),
    events: floatingRootContext.context.events,
    dataRef: floatingRootContext.context.dataRef,
    nodeId: undefined,
    get floatingId() {
      return floatingRootContext.select("floatingId");
    },
    refs: {
      reference: { current: null },
      floating: { current: null },
      domReference: { current: null },
      setReference() {},
      setFloating() {},
      setPositionReference() {},
    },
    elements: {
      get reference() {
        return null;
      },
      get floating() {
        return null;
      },
      get domReference() {
        return null;
      },
    },
    rootStore: floatingRootContext,
  };
}

/**
 * Syncs interaction props (from floating interactions) into the store, clearing them on unmount.
 */
export function syncPopupInteractionProps(
  store: PopupStoreLike,
  getStatePart: () => {
    activeTriggerProps: Record<string, any>;
    inactiveTriggerProps: Record<string, any>;
    popupProps: Record<string, any>;
  },
): void {
  createEffect(
    () => getStatePart(),
    (statePart) => {
      store.update(statePart);
    },
  );

  onCleanup(() => {
    untrack(() => {
      store.update({
        activeTriggerProps: {},
        inactiveTriggerProps: {},
        popupProps: {},
      });
    });
  });
}

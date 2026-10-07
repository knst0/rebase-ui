import { createEffect, onCleanup, untrack } from "solid-js";

import { createDismiss } from "../../internals/floating/interactions/createDismiss";
import {
  createPopupRootStore,
  getRootFloatingContext,
  syncPopupInteractionProps,
  trackImplicitActiveTrigger,
  trackOpenStateTransitions,
} from "../../internals/popups/popupStoreUtils";
import { stableCallback } from "../../internals/stableCallback";
import { PopoverStore } from "../store/PopoverStore";
import type { PopoverRoot } from "./PopoverRoot";

export interface CreatePopoverRootParameters {
  open: () => boolean | undefined;
  defaultOpen: () => boolean;
  modal: () => boolean | "trap-focus";
  triggerId: () => string | null | undefined;
  onOpenChange: (open: boolean, eventDetails: PopoverRoot.ChangeEventDetails) => void;
  onOpenChangeComplete: (open: boolean) => void;
}

export interface CreatePopoverRootReturnValue<Payload> {
  store: PopoverStore<Payload>;
  open: () => boolean;
  mounted: () => boolean;
  forceUnmount: () => void;
}

export function createPopoverRoot<Payload>(parameters: CreatePopoverRootParameters): CreatePopoverRootReturnValue<Payload> {
  const store = createPopupRootStore(
    (floatingId, nested) =>
      new PopoverStore<Payload>(
        {
          open: untrack(parameters.defaultOpen),
          openProp: untrack(parameters.open),
          triggerIdProp: untrack(parameters.triggerId),
        },
        floatingId,
        nested,
      ),
  );

  store.useSyncedValue("openProp", parameters.open);
  store.useSyncedValue("triggerIdProp", parameters.triggerId);

  const onOpenChange = stableCallback(() => parameters.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => parameters.onOpenChangeComplete);
  store.context.onOpenChange = onOpenChange;
  store.context.onOpenChangeComplete = onOpenChangeComplete;

  store.useSyncedValues(() => ({
    modal: parameters.modal(),
  }));

  const open = () => store.select("open") as boolean;
  const mounted = () => store.select("mounted") as boolean;

  trackImplicitActiveTrigger(store);
  const { forceUnmount } = trackOpenStateTransitions(open, store, () => {
    store.update({ stickIfOpen: true, openChangeReason: null });
  });

  createEffect(
    () => ({ openState: store.select("open") }),
    ({ openState }) => {
      if (!openState) {
        store.context.stickIfOpenTimeout.clear();
      }
      return undefined;
    },
  );

  // Resets the recorded open interaction once the popover is effectively closed.
  createEffect(
    () => open(),
    (openState) => {
      if (!openState && store.peek("openMethod") !== null) {
        store.set("openMethod", null);
      }
      return undefined;
    },
  );

  onCleanup(() => {
    store.context.stickIfOpenTimeout.clear();
    if (untrack(() => store.peek("openMethod")) !== null) {
      store.set("openMethod", null);
    }
  });

  setupPopoverInteractions(store, {
    modal: untrack(parameters.modal),
  });

  return { store, open, mounted, forceUnmount };
}

/**
 * Sets up the root-owned floating interactions (dismiss) and syncs their props
 * into the store for triggers and the popup to consume. Runs in the Root's body:
 * interaction creators read options once and access context, so they cannot run in effects.
 */
function setupPopoverInteractions<Payload>(store: PopoverStore<Payload>, options: { modal: boolean | "trap-focus" }): void {
  const { modal } = options;
  const floatingRootContext = untrack(() => store.select("floatingRootContext"));
  const rootContext = getRootFloatingContext(floatingRootContext);

  const dismiss = createDismiss(rootContext, {
    outsidePressEvent: {
      // Ensure `aria-hidden` on outside elements is removed immediately
      // on outside press when trapping focus.
      mouse: modal === "trap-focus" ? "sloppy" : "intentional",
      touch: "sloppy",
    },
  });

  // `createDismiss` always returns both prop bags. The store fields are non-optional.
  // `dismiss.reference` is the same object the trigger spreads.
  syncPopupInteractionProps(store, () => {
    const triggerProps = { ...dismiss.reference() };
    return {
      activeTriggerProps: triggerProps,
      inactiveTriggerProps: triggerProps,
      popupProps: { ...dismiss.floating() },
    };
  });
}

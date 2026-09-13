import { createEffect, untrack } from "solid-js";

import { createDismiss } from "../../internals/floating/interactions/createDismiss";
import {
  createPopupRootStore,
  getRootFloatingContext,
  syncPopupInteractionProps,
  trackImplicitActiveTrigger,
  trackOpenStateTransitions,
} from "../../internals/popups/popupStoreUtils";
import { stableCallback } from "../../internals/stableCallback";
import { PreviewCardStore } from "../store/PreviewCardStore";
import type { PreviewCardRoot } from "./PreviewCardRoot";

export interface CreatePreviewCardRootParameters {
  open: () => boolean | undefined;
  defaultOpen: () => boolean;
  triggerId: () => string | null | undefined;
  onOpenChange: (open: boolean, eventDetails: PreviewCardRoot.ChangeEventDetails) => void;
  onOpenChangeComplete: (open: boolean) => void;
}

export interface CreatePreviewCardRootReturnValue<Payload> {
  store: PreviewCardStore<Payload>;
  open: () => boolean;
  mounted: () => boolean;
  forceUnmount: () => void;
}

export function createPreviewCardRoot<Payload>(parameters: CreatePreviewCardRootParameters): CreatePreviewCardRootReturnValue<Payload> {
  const store = createPopupRootStore(
    (floatingId, nested) =>
      new PreviewCardStore<Payload>(
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

  const open = () => store.select("open") as boolean;
  const mounted = () => store.select("mounted") as boolean;

  trackImplicitActiveTrigger(store, { closeOnActiveTriggerUnmount: true });
  const { forceUnmount } = trackOpenStateTransitions(open, store, () => {
    store.context.inlineRectCoordsRef.current = undefined;
  });

  createEffect(
    () => ({ isOpen: open(), activeTriggerId: store.select("activeTriggerId") }),
    ({ isOpen, activeTriggerId }) => {
      if (isOpen && activeTriggerId == null) {
        store.set("payload", undefined);
      }
      return undefined;
    },
  );

  setupPreviewCardInteractions(store);

  return { store, open, mounted, forceUnmount };
}

/**
 * Sets up the root-owned floating interactions (dismiss) and syncs their props
 * into the store for triggers and the popup to consume. Runs in the Root's body:
 * interaction creators read options once and access context, so they cannot run in effects.
 */
function setupPreviewCardInteractions<Payload>(store: PreviewCardStore<Payload>): void {
  const floatingRootContext = untrack(() => store.select("floatingRootContext"));
  const rootContext = getRootFloatingContext(floatingRootContext);

  const dismiss = createDismiss(rootContext);

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

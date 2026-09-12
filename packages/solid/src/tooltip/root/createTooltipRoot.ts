import { createEffect, untrack } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { createClientPoint } from "../../internals/floating/interactions/createClientPoint";
import { createDismiss } from "../../internals/floating/interactions/createDismiss";
import {
  createPopupRootStore,
  getRootFloatingContext,
  syncPopupInteractionProps,
  trackImplicitActiveTrigger,
  trackOpenStateTransitions,
} from "../../internals/popups/popupStoreUtils";
import { stableCallback } from "../../internals/stableCallback";
import { TooltipStore, type TooltipStoreState } from "../store/TooltipStore";
import type { TooltipRoot } from "./TooltipRoot";

export type TooltipTrackCursorAxis = "none" | "x" | "y" | "both";

export interface CreateTooltipRootParameters {
  open: () => boolean | undefined;
  defaultOpen: () => boolean;
  disabled: () => boolean;
  trackCursorAxis: () => TooltipTrackCursorAxis;
  disableHoverablePopup: () => boolean;
  triggerId: () => string | null | undefined;
  onOpenChange: (open: boolean, eventDetails: TooltipRoot.ChangeEventDetails) => void;
  onOpenChangeComplete: (open: boolean) => void;
}

export interface CreateTooltipRootReturnValue<Payload> {
  store: TooltipStore<Payload>;
  open: () => boolean;
  mounted: () => boolean;
  forceUnmount: () => void;
}

export function createTooltipRoot<Payload>(parameters: CreateTooltipRootParameters): CreateTooltipRootReturnValue<Payload> {
  const store = createPopupRootStore(
    (floatingId, nested) =>
      new TooltipStore<Payload>(
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
    trackCursorAxis: parameters.trackCursorAxis(),
    disableHoverablePopup: parameters.disableHoverablePopup(),
    disabled: parameters.disabled(),
  }));

  const open = () => !parameters.disabled() && (store.select("open") as boolean);
  const mounted = () => store.select("mounted") as boolean;

  trackImplicitActiveTrigger(store, { closeOnActiveTriggerUnmount: true });
  const { forceUnmount, transitionStatus } = trackOpenStateTransitions(open, store);

  setupTooltipInteractions(store, {
    disabled: untrack(parameters.disabled),
    trackCursorAxis: untrack(parameters.trackCursorAxis),
  });

  const isInstantPhase = () => store.select("isInstantPhase") as boolean;

  // Animations should be instant in two cases:
  // 1) Opening during the provider's instant phase (adjacent tooltip opens instantly)
  // 2) Closing because another tooltip opened (reason === 'none')
  // Otherwise, allow the animation to play.
  let previousInstantType: TooltipStoreState<Payload>["instantType"] | null = null;

  createEffect(
    () => ({
      status: transitionStatus(),
      instantPhase: isInstantPhase(),
      reason: store.select("lastOpenChangeReason"),
      instantType: store.select("instantType"),
    }),
    ({ status, instantPhase, reason, instantType }) => {
      if ((status === "ending" && reason === REASONS.none) || (status !== "ending" && instantPhase)) {
        // Capture the current instant type so we can restore it later
        // and set to 'delay' to disable animations while moving from one trigger to another
        // within a delay group.
        if (instantType !== "delay") {
          previousInstantType = instantType as TooltipStoreState<Payload>["instantType"];
        }
        store.set("instantType", "delay");
      } else if (previousInstantType !== null) {
        store.set("instantType", previousInstantType);
        previousInstantType = null;
      }
      return undefined;
    },
  );

  createEffect(
    () => ({ openState: store.select("open"), disabled: parameters.disabled() }),
    ({ openState, disabled }) => {
      if (openState && disabled) {
        store.setOpen(false, createChangeEventDetails(REASONS.disabled));
      }
      return undefined;
    },
  );

  createEffect(
    () => ({ isOpen: open(), activeTriggerId: store.select("activeTriggerId") }),
    ({ isOpen, activeTriggerId }) => {
      if (isOpen && activeTriggerId == null) {
        store.set("payload", undefined);
      }
      return undefined;
    },
  );

  return { store, open, mounted, forceUnmount };
}

/**
 * Sets up the root-owned floating interactions (dismiss + cursor tracking) and syncs their
 * props into the store for triggers and the popup to consume. Runs in the Root's body:
 * interaction creators read options once and access context, so they cannot run in effects.
 */
function setupTooltipInteractions<Payload>(
  store: TooltipStore<Payload>,
  options: { disabled: boolean; trackCursorAxis: TooltipTrackCursorAxis },
): void {
  const { disabled, trackCursorAxis } = options;
  const floatingRootContext = untrack(() => store.select("floatingRootContext"));
  const rootContext = getRootFloatingContext(floatingRootContext);

  const dismiss = createDismiss(rootContext, {
    enabled: !disabled,
    referencePress: () => untrack(() => store.select("closeOnClick")) as boolean,
  });
  const clientPoint = createClientPoint(rootContext, {
    enabled: !disabled && trackCursorAxis !== "none",
    axis: trackCursorAxis === "none" ? undefined : trackCursorAxis,
  });

  // Both creators return `trigger: reference` (same object identity), so the active and
  // inactive trigger props can never differ. `createClientPoint` has no floating-side props.
  syncPopupInteractionProps(store, () => {
    const triggerProps = mergeInteractionProps({ ...clientPoint.reference() }, { ...dismiss.reference() });
    return {
      activeTriggerProps: triggerProps,
      inactiveTriggerProps: triggerProps,
      popupProps: { ...dismiss.floating() },
    };
  });
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
      const value = source[key];
      const existing = merged[key];
      if (typeof value === "function" && key.startsWith("on") && typeof existing === "function") {
        const first = existing as (...args: Array<any>) => void;
        const second = value as (...args: Array<any>) => void;
        merged[key] = (...args: Array<any>) => {
          first(...args);
          second(...args);
        };
      } else {
        merged[key] = value;
      }
    }
  }
  return merged;
}

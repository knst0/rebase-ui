import type { AdaptiveOriginMiddleware } from "../../internals/anchor-positioning/adaptiveOrigin";
import { createChangeEventDetails } from "../../internals/event-details";
import { REASONS } from "../../internals/event-details";
import { PopupTriggerMap } from "../../internals/floating/triggerMap";
import { PopupStore } from "../../internals/popups/PopupStore";
import { createInitialPopupStoreState, popupStoreSelectors, type PopupStoreContext } from "../../internals/popups/popupStoreState";
import { applyPopupOpenChange } from "../../internals/popups/popupStoreUtils";
import type { TooltipRoot } from "../root/TooltipRoot";

export type TooltipStoreState<Payload> = import("../../internals/popups/popupStoreState").PopupStoreState<Payload> & {
  disabled: boolean;
  instantType: "delay" | "dismiss" | "focus" | undefined;
  isInstantPhase: boolean;
  trackCursorAxis: "none" | "x" | "y" | "both";
  disableHoverablePopup: boolean;
  openChangeReason: TooltipRoot.ChangeEventReason | null;
  closeOnClick: boolean;
  closeDelay: number;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

export type TooltipStoreContext = PopupStoreContext<TooltipRoot.ChangeEventDetails> & {
  readonly popupRef: { current: HTMLElement | null };
};

const tooltipStoreSelectors = {
  ...popupStoreSelectors,
  disabled: (state: TooltipStoreState<unknown>) => state.disabled,
  instantType: (state: TooltipStoreState<unknown>) => state.instantType,
  isInstantPhase: (state: TooltipStoreState<unknown>) => state.isInstantPhase,
  trackCursorAxis: (state: TooltipStoreState<unknown>) => state.trackCursorAxis,
  disableHoverablePopup: (state: TooltipStoreState<unknown>) => state.disableHoverablePopup,
  lastOpenChangeReason: (state: TooltipStoreState<unknown>) => state.openChangeReason,
  closeOnClick: (state: TooltipStoreState<unknown>) => state.closeOnClick,
  closeDelay: (state: TooltipStoreState<unknown>) => state.closeDelay,
  adaptiveOrigin: (state: TooltipStoreState<unknown>): AdaptiveOriginMiddleware | undefined => state.adaptiveOrigin,
};

export type TooltipStoreSelectors = typeof tooltipStoreSelectors;

export class TooltipStore<Payload = unknown> extends PopupStore<TooltipStoreState<Payload>, TooltipStoreSelectors> {
  constructor(initialState: Partial<TooltipStoreState<Payload>>, floatingId: string | undefined, nested: boolean) {
    const triggerElements = new PopupTriggerMap();
    super(
      createInitialState<Payload>(initialState, triggerElements, floatingId, nested),
      createInitialContext(triggerElements),
      tooltipStoreSelectors as TooltipStoreSelectors,
    );
  }

  setOpen = (nextOpen: boolean, eventDetails: Omit<TooltipRoot.ChangeEventDetails, "preventUnmountOnClose">) => {
    applyPopupOpenChange<TooltipStoreState<Payload>, TooltipRoot.ChangeEventDetails, "openChangeReason">(
      this,
      nextOpen,
      eventDetails as TooltipRoot.ChangeEventDetails,
      {
        extraState: { openChangeReason: eventDetails.reason },
      },
    );
  };

  // Used by trigger clicks to clear a delayed hover open without reporting a public open-state change.
  cancelPendingOpen(event: MouseEvent | PointerEvent) {
    this.peekState().floatingRootContext.dispatchOpenChange(false, createChangeEventDetails(REASONS.triggerPress, event));
  }
}

/**
 * The store view that detached handle-backed triggers read from: the trigger-data members plus
 * `setOpen`/`cancelPendingOpen` (called directly by the trigger) and `useSyncedValue`.
 */
export type TooltipHandleStore<Payload> = Pick<
  TooltipStore<Payload>,
  "context" | "select" | "set" | "state" | "update" | "useState" | "useSyncedValue" | "setOpen" | "cancelPendingOpen"
>;

function createInitialState<Payload>(
  initialState: Partial<TooltipStoreState<Payload>> | undefined,
  triggerElements: PopupTriggerMap,
  floatingId?: string | undefined,
  nested = false,
): TooltipStoreState<Payload> {
  const state: TooltipStoreState<Payload> = {
    ...createInitialPopupStoreState<Payload>(triggerElements, floatingId, nested),
    disabled: false,
    instantType: undefined,
    isInstantPhase: false,
    trackCursorAxis: "none",
    disableHoverablePopup: false,
    openChangeReason: null,
    closeOnClick: true,
    closeDelay: 0,
    adaptiveOrigin: undefined,
    ...initialState,
  };

  return state;
}

function createInitialContext(triggerElements: PopupTriggerMap): TooltipStoreContext {
  return {
    popupRef: { current: null },
    onOpenChange: undefined,
    onOpenChangeComplete: undefined,
    triggerElements,
  };
}

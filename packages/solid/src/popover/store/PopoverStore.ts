import { flush } from "solid-js";

import type { AdaptiveOriginMiddleware } from "../../internals/anchor-positioning/adaptiveOrigin";
import { REASONS } from "../../internals/event-details";
import { Timeout } from "../../internals/floating/interactions/createHoverInteractionSharedState";
import { PopupTriggerMap } from "../../internals/floating/triggerMap";
import { PopupStore } from "../../internals/popups/PopupStore";
import { createInitialPopupStoreState, popupStoreSelectors, type PopupStoreContext } from "../../internals/popups/popupStoreState";
import { attachPreventUnmountOnClose, createPopupOpenState } from "../../internals/popups/popupStoreUtils";
import type { PopoverRoot } from "../root/PopoverRoot";
import { PATIENT_CLICK_THRESHOLD } from "../utils/constants";

export type PopoverInteractionType = "keyboard" | "mouse" | "touch" | "pen" | "";

export type PopoverStoreState<Payload> = import("../../internals/popups/popupStoreState").PopupStoreState<Payload> & {
  disabled: boolean;
  instantType: "dismiss" | "click" | "focus" | "trigger-change" | undefined;
  modal: boolean | "trap-focus";
  focusManagerModal: boolean;
  openMethod: PopoverInteractionType | null;
  openChangeReason: PopoverRoot.ChangeEventReason | null;
  stickIfOpen: boolean;
  titleElementId: string | undefined;
  descriptionElementId: string | undefined;
  openOnHover: boolean;
  closeDelay: number;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

export type PopoverStoreContext = PopupStoreContext<PopoverRoot.ChangeEventDetails> & {
  readonly popupRef: { current: HTMLElement | null };
  readonly triggerFocusTargetRef: { current: HTMLElement | null };
  readonly beforeContentFocusGuardRef: { current: HTMLElement | null };
  readonly stickIfOpenTimeout: Timeout;
};

const popoverStoreSelectors = {
  ...popupStoreSelectors,
  disabled: (state: PopoverStoreState<unknown>) => state.disabled,
  instantType: (state: PopoverStoreState<unknown>) => state.instantType,
  openMethod: (state: PopoverStoreState<unknown>) => state.openMethod,
  openChangeReason: (state: PopoverStoreState<unknown>) => state.openChangeReason,
  modal: (state: PopoverStoreState<unknown>) => state.modal,
  focusManagerModal: (state: PopoverStoreState<unknown>) => state.focusManagerModal,
  stickIfOpen: (state: PopoverStoreState<unknown>) => state.stickIfOpen,
  titleElementId: (state: PopoverStoreState<unknown>) => state.titleElementId,
  descriptionElementId: (state: PopoverStoreState<unknown>) => state.descriptionElementId,
  openOnHover: (state: PopoverStoreState<unknown>) => state.openOnHover,
  closeDelay: (state: PopoverStoreState<unknown>) => state.closeDelay,
  adaptiveOrigin: (state: PopoverStoreState<unknown>): AdaptiveOriginMiddleware | undefined => state.adaptiveOrigin,
};

export type PopoverStoreSelectors = typeof popoverStoreSelectors;

export class PopoverStore<Payload = unknown> extends PopupStore<PopoverStoreState<Payload>, PopoverStoreSelectors, PopoverStoreContext> {
  constructor(initialState: Partial<PopoverStoreState<Payload>>, floatingId: string | undefined, nested: boolean) {
    const triggerElements = new PopupTriggerMap();
    super(
      createInitialState<Payload>(initialState, triggerElements, floatingId, nested),
      createInitialContext(triggerElements),
      popoverStoreSelectors as PopoverStoreSelectors,
    );
  }

  setOpen = (nextOpen: boolean, eventDetails: Omit<PopoverRoot.ChangeEventDetails, "preventUnmountOnClose">) => {
    const reason = eventDetails.reason;
    const isHover = reason === REASONS.triggerHover;
    const isKeyboardClick = reason === REASONS.triggerPress && (eventDetails.event as MouseEvent).detail === 0;
    const isDismissClose = !nextOpen && (reason === REASONS.escapeKey || reason == null);

    const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(eventDetails as PopoverRoot.ChangeEventDetails);

    const activeTriggerId = this.peek("activeTriggerId") as string | null;

    if (!nextOpen && reason === REASONS.closePress && eventDetails.trigger == null && activeTriggerId != null) {
      (eventDetails as { trigger?: Element | undefined }).trigger =
        (this.context.triggerElements.getById(activeTriggerId) as Element | null) ??
        (this.peek("activeTriggerElement") as Element | null) ??
        undefined;
    }

    this.context.onOpenChange?.(nextOpen, eventDetails as PopoverRoot.ChangeEventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    // One-shot snapshot read: event handlers don't track, and the surrounding
    // computations subscribe to the values they need.
    const snapshot = this.peekState();

    snapshot.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);

    const changeState = () => {
      const popupOpenState = createPopupOpenState(
        snapshot,
        nextOpen,
        (eventDetails as { trigger?: Element | undefined }).trigger,
        shouldPreventUnmountOnClose(),
      );

      this.update({ ...popupOpenState, openChangeReason: reason } as Partial<PopoverStoreState<Payload>>);
    };

    if (isHover) {
      // Only allow "patient" clicks to close the popover if it's open.
      // If they clicked within 500ms of the popover opening, keep it open.
      this.set("stickIfOpen", true);
      this.context.stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
        this.set("stickIfOpen", false);
      });

      // Commit synchronously for hover so `node.getAnimations()` sees the new state.
      changeState();
      flush();
    } else {
      changeState();
    }

    let instantType: PopoverStoreState<Payload>["instantType"];
    if (isKeyboardClick) {
      instantType = "click";
    } else if (isDismissClose) {
      instantType = "dismiss";
    } else if (reason === REASONS.focusOut) {
      instantType = "focus";
    }
    this.set("instantType", instantType);
  };
}

function createInitialState<Payload>(
  initialState: Partial<PopoverStoreState<Payload>> | undefined,
  triggerElements: PopupTriggerMap,
  floatingId?: string,
  nested = false,
): PopoverStoreState<Payload> {
  const state: PopoverStoreState<Payload> = {
    ...createInitialPopupStoreState<Payload>(triggerElements, floatingId, nested),
    disabled: false,
    modal: false,
    focusManagerModal: false,
    instantType: undefined,
    openMethod: null,
    openChangeReason: null,
    titleElementId: undefined,
    descriptionElementId: undefined,
    stickIfOpen: true,
    openOnHover: false,
    closeDelay: 0,
    adaptiveOrigin: undefined,
    ...initialState,
  };

  if (state.open && initialState?.mounted === undefined) {
    state.mounted = true;
  }

  return state;
}

function createInitialContext(triggerElements: PopupTriggerMap): PopoverStoreContext {
  return {
    popupRef: { current: null },
    onOpenChange: undefined,
    onOpenChangeComplete: undefined,
    triggerFocusTargetRef: { current: null },
    beforeContentFocusGuardRef: { current: null },
    stickIfOpenTimeout: new Timeout(),
    triggerElements,
  };
}

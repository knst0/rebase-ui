import type { AdaptiveOriginMiddleware } from "../../internals/anchor-positioning/adaptiveOrigin";
import { REASONS } from "../../internals/event-details";
import { PopupTriggerMap } from "../../internals/floating/triggerMap";
import { PopupStore } from "../../internals/popups/PopupStore";
import { createInitialPopupStoreState, popupStoreSelectors, type PopupStoreContext } from "../../internals/popups/popupStoreState";
import { applyPopupOpenChange } from "../../internals/popups/popupStoreUtils";
import type { PreviewCardRoot } from "../root/PreviewCardRoot";
import { CLOSE_DELAY } from "../utils/constants";
import { updateInlineRectCoords, type InlineRectCoords } from "../utils/inlineRect";

export type PreviewCardStoreState<Payload> = import("../../internals/popups/popupStoreState").PopupStoreState<Payload> & {
  instantType: "dismiss" | "focus" | undefined;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
  closeDelay: number;
};

export type PreviewCardStoreContext = PopupStoreContext<PreviewCardRoot.ChangeEventDetails> & {
  readonly popupRef: { current: HTMLElement | null };
  readonly inlineRectCoordsRef: { current: InlineRectCoords | undefined };
};

const previewCardStoreSelectors = {
  ...popupStoreSelectors,
  instantType: (state: PreviewCardStoreState<unknown>) => state.instantType,
  adaptiveOrigin: (state: PreviewCardStoreState<unknown>): AdaptiveOriginMiddleware | undefined => state.adaptiveOrigin,
  closeDelay: (state: PreviewCardStoreState<unknown>) => state.closeDelay,
};

export type PreviewCardStoreSelectors = typeof previewCardStoreSelectors;

export class PreviewCardStore<Payload = unknown> extends PopupStore<
  PreviewCardStoreState<Payload>,
  PreviewCardStoreSelectors,
  PreviewCardStoreContext
> {
  constructor(initialState: Partial<PreviewCardStoreState<Payload>>, floatingId: string | undefined, nested: boolean) {
    const triggerElements = new PopupTriggerMap();
    super(
      createInitialState<Payload>(initialState, triggerElements, floatingId, nested),
      createInitialContext(triggerElements),
      previewCardStoreSelectors as PreviewCardStoreSelectors,
    );
  }

  setOpen = (nextOpen: boolean, eventDetails: Omit<PreviewCardRoot.ChangeEventDetails, "preventUnmountOnClose">) => {
    const { inlineRectCoordsRef } = this.context;

    applyPopupOpenChange<PreviewCardStoreState<Payload>, PreviewCardRoot.ChangeEventDetails>(
      this,
      nextOpen,
      eventDetails as PreviewCardRoot.ChangeEventDetails,
      {
        onBeforeDispatch() {
          // Capture the hovered inline-rect coordinates so the card anchors to the
          // exact point on the link that was hovered.
          const event = eventDetails.event;
          if (
            nextOpen &&
            eventDetails.reason === REASONS.triggerHover &&
            eventDetails.trigger &&
            event != null &&
            typeof event === "object" &&
            "clientX" in event &&
            "clientY" in event &&
            inlineRectCoordsRef.current?.element !== eventDetails.trigger
          ) {
            updateInlineRectCoords(inlineRectCoordsRef, eventDetails.trigger, (event as MouseEvent).clientX, (event as MouseEvent).clientY);
          }
        },
      },
    );
  };
}

/**
 * The store view that detached handle-backed triggers read from: the trigger-data members plus
 * `setOpen` (called directly by the trigger) and `useSyncedValue`.
 */
export type PreviewCardHandleStore<Payload> = Pick<
  PreviewCardStore<Payload>,
  "context" | "select" | "set" | "state" | "update" | "useState" | "useSyncedValue" | "setOpen"
>;

function createInitialState<Payload>(
  initialState: Partial<PreviewCardStoreState<Payload>> | undefined,
  triggerElements: PopupTriggerMap,
  floatingId?: string,
  nested = false,
): PreviewCardStoreState<Payload> {
  const state: PreviewCardStoreState<Payload> = {
    ...createInitialPopupStoreState<Payload>(triggerElements, floatingId, nested),
    instantType: undefined,
    adaptiveOrigin: undefined,
    closeDelay: CLOSE_DELAY,
    ...initialState,
  };

  return state;
}

function createInitialContext(triggerElements: PopupTriggerMap): PreviewCardStoreContext {
  return {
    popupRef: { current: null },
    onOpenChange: undefined,
    onOpenChangeComplete: undefined,
    triggerElements,
    inlineRectCoordsRef: { current: undefined },
  };
}

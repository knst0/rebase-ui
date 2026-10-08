import { isServer, type JSX } from "@solidjs/web";
import { createEffect, createSignal, flush, onCleanup, untrack } from "solid-js";

import { adaptiveOrigin } from "../anchor-positioning/adaptiveOrigin";
import type { Side } from "../anchor-positioning/createAnchorPositioning";
import { createAnimationsFinishedRunner } from "../createAnimationsFinishedRunner";
import type { Dimensions } from "../utils/getCssDimensions";
import { trackPopupAutoResize } from "./popupAutoResize";
import type { PopupStoreLike } from "./popupStoreUtils";

export interface PopupViewportState {
  /**
   * Direction from which the popup was activated, used for directional animations.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
}

export interface CreatePopupViewportOptions {
  store: PopupStoreLike;
  /**
   * Side of the positioner relative to the trigger.
   */
  side: () => Side;
  /**
   * Viewport children to render in the current container. Read lazily so a payload change
   * updates the content in place instead of replacing the container.
   */
  children: () => JSX.Element;
}

export interface CreatePopupViewportReturnValue {
  /**
   * The viewport children wrapped in current/previous containers as needed.
   */
  children: () => JSX.Element;
  /**
   * Viewport state used for data attributes and render prop styling.
   */
  state: PopupViewportState;
}

type Offset = {
  horizontal: number;
  vertical: number;
};

/**
 * Builds morphing viewport containers for popups that animate between trigger-based content.
 * Handles previous-content snapshots, auto-resize, and state attributes for transitions.
 * Ported from Base UI `utils/usePopupViewport.tsx`.
 */
export function createPopupViewport(options: CreatePopupViewportOptions): CreatePopupViewportReturnValue {
  const { store } = options;

  let currentContainer: HTMLDivElement | null = null;
  let previousContainer: HTMLDivElement | null = null;
  let capturedNode: HTMLElement | null = null;

  const [previousContentNode, setPreviousContentNode] = createSignal<HTMLElement | null>(null);
  const [newTriggerOffset, setNewTriggerOffset] = createSignal<Offset | null>(null);
  const [previousContentDimensions, setPreviousContentDimensions] = createSignal<Dimensions | null>(null);
  const [showStartingStyleAttribute, setShowStartingStyleAttribute] = createSignal(false);
  const [contentKey, setContentKey] = createSignal(0);

  // Mirrors upstream's layout effect: the positioner switches to side-anchored
  // offsets while a viewport is mounted.
  store.set("adaptiveOrigin", adaptiveOrigin);
  onCleanup(() => {
    if (isServer) return;
    untrack(() => {
      store.set("adaptiveOrigin", undefined);
    });
  });

  const onAnimationsFinished = createAnimationsFinishedRunner(
    () => currentContainer,
    () => true,
  );

  let frame: number | undefined;
  const cancelFrame = () => {
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
  };
  onCleanup(cancelFrame);

  let cleanupController: AbortController | null = null;
  onCleanup(() => cleanupController?.abort());

  const armViewportCleanup = () => {
    cleanupController?.abort();
    const controller = new AbortController();
    cleanupController = controller;
    onAnimationsFinished(() => {
      setPreviousContentNode(null);
      setPreviousContentDimensions(null);
      capturedNode = null;
    }, controller.signal);
  };

  // Remount current content on trigger changes (and once more when payload lags) to avoid DOM reuse flashes.
  // The key bumps immediately on trigger switches, then again if the payload arrives on a later run.
  let previousActiveTriggerId = untrack(() => store.select("activeTriggerId")) as string | null;
  let previousPayload = untrack(() => store.select("payload"));
  let pendingPayloadUpdate = false;

  createEffect(
    () => ({ id: store.select("activeTriggerId"), payload: store.select("payload") }),
    ({ id, payload }) => {
      // Compare against the last committed values to decide whether we need a new DOM subtree.
      const triggerIdChanged = id !== previousActiveTriggerId;
      const payloadChanged = payload !== previousPayload;

      if (triggerIdChanged) {
        // Remount immediately on trigger change; remember if payload hasn't caught up yet.
        setContentKey((value) => value + 1);
        pendingPayloadUpdate = !payloadChanged;
      } else if (pendingPayloadUpdate && payloadChanged) {
        // Payload arrived a run later, so remount once more to avoid reusing the old content.
        setContentKey((value) => value + 1);
        pendingPayloadUpdate = false;
      }

      // Persist current values for the next run's comparison.
      previousActiveTriggerId = id as string | null;
      previousPayload = payload;
      return undefined;
    },
  );

  const getContentKey = () => `${(store.select("activeTriggerId") as string | null) ?? "current"}-${contentKey()}`;

  let lastHandledTrigger: Element | null = null;

  createEffect(
    () => ({ isOpen: store.select("open"), isMounted: store.select("mounted") }),
    ({ isOpen, isMounted }) => {
      if (!isOpen || !isMounted) {
        lastHandledTrigger = null;
      }
      return undefined;
    },
  );

  let previousActiveTrigger: Element | null = null;

  createEffect(
    () => ({ activeTrigger: store.select("activeTriggerElement"), isOpen: store.select("open") }),
    ({ activeTrigger, isOpen }) => {
      const prev = previousActiveTrigger;
      previousActiveTrigger = isOpen ? (activeTrigger as Element | null) : null;

      // When a trigger changes, set the captured children HTML to state,
      // so we can render both new and old content.
      if (activeTrigger && prev && activeTrigger !== prev && lastHandledTrigger !== activeTrigger && capturedNode) {
        setPreviousContentNode(capturedNode);
        setShowStartingStyleAttribute(true);

        // Calculate the relative position between the previous and new trigger,
        // so we can pass it to the style hook for animation purposes.
        const offset = calculateRelativePosition(prev, activeTrigger as Element);
        setNewTriggerOffset(offset);

        lastHandledTrigger = activeTrigger as Element;
      }
      return undefined;
    },
  );

  // Arm cleanup after a trigger change, and re-arm it if the current container remounts
  // mid-transition when a lagging payload bumps the content key.
  createEffect(
    () => ({ key: getContentKey(), previousNode: previousContentNode() }),
    () => {
      if (untrack(previousContentNode) == null) {
        return undefined;
      }

      // Abort the stale watcher synchronously. The remount cancels the old container's
      // animations, and the resulting promise rejection would otherwise run the cleanup
      // in a microtask before the re-armed watcher below is in place.
      cleanupController?.abort();

      setShowStartingStyleAttribute(true);

      cancelFrame();
      frame = requestAnimationFrame(() => {
        frame = undefined;
        setShowStartingStyleAttribute(false);
        flush();
        armViewportCleanup();
      });

      return undefined;
    },
  );

  // Capture a clone of the current content DOM subtree when not transitioning.
  // We can't store previous nodes as they may be stateful; instead we capture DOM clones for visual continuity.
  createEffect(
    () => ({ key: getContentKey(), payload: store.select("payload") }),
    () => {
      // When a transition is in progress, we store the next content in `capturedNode`.
      // This handles the case where the trigger changes multiple times before the transition finishes.
      const source = currentContainer;
      if (!source) {
        return undefined;
      }

      const wrapper = source.ownerDocument.createElement("div");
      for (const child of Array.from(source.childNodes)) {
        wrapper.appendChild(child.cloneNode(true));
      }

      capturedNode = wrapper;
      return undefined;
    },
  );

  // When previousContentNode is present, imperatively populate the previous container with the cloned children.
  createEffect(
    () => previousContentNode(),
    (node) => {
      const container = previousContainer;
      if (!container || !node) {
        return undefined;
      }

      container.replaceChildren(...Array.from(node.childNodes));
      return undefined;
    },
  );

  const handleMeasureLayout = () => {
    currentContainer?.style.setProperty("animation", "none");
    currentContainer?.style.setProperty("transition", "none");

    previousContainer?.style.setProperty("display", "none");
  };

  const handleMeasureLayoutComplete = (previousDimensions: Dimensions | null) => {
    currentContainer?.style.removeProperty("animation");
    currentContainer?.style.removeProperty("transition");

    previousContainer?.style.removeProperty("display");

    if (previousDimensions) {
      setPreviousContentDimensions(previousDimensions);
    }
  };

  trackPopupAutoResize({
    popupElement: () => store.select("popupElement") as HTMLElement | null,
    positionerElement: () => store.select("positionerElement") as HTMLElement | null,
    mounted: () => store.select("mounted") as boolean,
    content: () => store.select("payload"),
    onMeasureLayout: handleMeasureLayout,
    onMeasureLayoutComplete: handleMeasureLayoutComplete,
    side: options.side,
    direction: typeof document !== "undefined" && document.documentElement.dir === "rtl" ? "rtl" : "ltr",
  });

  function renderChildren(): JSX.Element {
    // Subscribe to the remount key: returning a fresh container replaces the old DOM subtree.
    getContentKey();

    if (previousContentNode() == null) {
      return (
        <div
          data-current=""
          ref={(element: HTMLDivElement | null) => {
            currentContainer = element;
          }}
        >
          {options.children()}
        </div>
      );
    }

    const dimensions = previousContentDimensions();
    return (
      <>
        <div
          data-previous=""
          inert={true}
          ref={(element: HTMLDivElement | null) => {
            previousContainer = element;
          }}
          style={
            {
              ...(dimensions ? { "--popup-width": `${dimensions.width}px`, "--popup-height": `${dimensions.height}px` } : null),
              position: "absolute",
            } as JSX.CSSProperties
          }
          data-ending-style={showStartingStyleAttribute() ? undefined : ""}
        />
        <div
          data-current=""
          ref={(element: HTMLDivElement | null) => {
            currentContainer = element;
          }}
          data-starting-style={showStartingStyleAttribute() ? "" : undefined}
        >
          {options.children()}
        </div>
      </>
    );
  }

  return {
    children: renderChildren,
    state: {
      get activationDirection() {
        return getActivationDirection(newTriggerOffset());
      },
      get transitioning() {
        return previousContentNode() != null;
      },
    },
  };
}

/**
 * Returns a string describing the provided offset.
 * It describes both the horizontal and vertical offset, separated by a space.
 */
function getActivationDirection(offset: Offset | null): string | undefined {
  if (!offset) {
    return undefined;
  }

  return `${getValueWithTolerance(offset.horizontal, 5, "right", "left")} ${getValueWithTolerance(offset.vertical, 5, "down", "up")}`;
}

/**
 * Returns a label describing the value (positive/negative) treating values
 * within tolerance as zero.
 */
function getValueWithTolerance(value: number, tolerance: number, positiveLabel: string, negativeLabel: string) {
  if (value > tolerance) {
    return positiveLabel;
  }

  if (value < -tolerance) {
    return negativeLabel;
  }

  return "";
}

/**
 * Calculates the relative position between centers of two elements.
 */
function calculateRelativePosition(from: Element, to: Element): Offset {
  const fromRect = from.getBoundingClientRect();
  const toRect = to.getBoundingClientRect();

  const fromCenter = {
    x: fromRect.left + fromRect.width / 2,
    y: fromRect.top + fromRect.height / 2,
  };
  const toCenter = {
    x: toRect.left + toRect.width / 2,
    y: toRect.top + toRect.height / 2,
  };

  return {
    horizontal: toCenter.x - fromCenter.x,
    vertical: toCenter.y - fromCenter.y,
  };
}

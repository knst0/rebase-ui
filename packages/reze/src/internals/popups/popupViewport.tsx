import { effect, onCleanup, store, untrack, type JSX } from "reze-js";

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
  const { store: popupStore } = options;

  let currentContainer: HTMLDivElement | null = null;
  let previousContainer: HTMLDivElement | null = null;
  let capturedNode: HTMLElement | null = null;

  const viewportState = store({
    previousContentNode: null as HTMLElement | null,
    newTriggerOffset: null as Offset | null,
    previousContentDimensions: null as Dimensions | null,
    showStartingStyleAttribute: false,
    contentKey: 0,
  });

  function previousContentNode(): HTMLElement | null {
    return viewportState.previousContentNode;
  }

  function newTriggerOffset(): Offset | null {
    return viewportState.newTriggerOffset;
  }

  function previousContentDimensions(): Dimensions | null {
    return viewportState.previousContentDimensions;
  }

  function showStartingStyleAttribute(): boolean {
    return viewportState.showStartingStyleAttribute;
  }

  function contentKey(): number {
    return viewportState.contentKey;
  }

  // Mirrors upstream's layout effect: the positioner switches to side-anchored
  // offsets while a viewport is mounted.
  popupStore.set("adaptiveOrigin", adaptiveOrigin);
  onCleanup(() => {
    untrack(() => {
      popupStore.set("adaptiveOrigin", undefined);
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
      untrack(() => {
        viewportState.previousContentNode = null;
        viewportState.previousContentDimensions = null;
      });
      capturedNode = null;
    }, controller.signal);
  };

  // Remount current content on trigger changes (and once more when payload lags) to avoid DOM reuse flashes.
  // The key bumps immediately on trigger switches, then again if the payload arrives on a later run.
  let previousActiveTriggerId = untrack(() => popupStore.select("activeTriggerId")) as string | null;
  let previousPayload = untrack(() => popupStore.select("payload"));
  let pendingPayloadUpdate = false;

  effect(() => {
    const id = popupStore.select("activeTriggerId");
    const payload = popupStore.select("payload");
    // One-shot key bump: the values only steer these writes.
    untrack(() => {
      // Compare against the last committed values to decide whether we need a new DOM subtree.
      const triggerIdChanged = id !== previousActiveTriggerId;
      const payloadChanged = payload !== previousPayload;

      if (triggerIdChanged) {
        // Remount immediately on trigger change; remember if payload hasn't caught up yet.
        viewportState.contentKey += 1;
        pendingPayloadUpdate = !payloadChanged;
      } else if (pendingPayloadUpdate && payloadChanged) {
        // Payload arrived a run later, so remount once more to avoid reusing the old content.
        viewportState.contentKey += 1;
        pendingPayloadUpdate = false;
      }

      // Persist current values for the next run's comparison.
      previousActiveTriggerId = id as string | null;
      previousPayload = payload;
    });
  });

  const getContentKey = () => `${(popupStore.select("activeTriggerId") as string | null) ?? "current"}-${contentKey()}`;

  let lastHandledTrigger: Element | null = null;

  effect(() => {
    const isOpen = popupStore.select("open");
    const isMounted = popupStore.select("mounted");
    // One-shot local reset: the values only steer this write.
    untrack(() => {
      if (!isOpen || !isMounted) {
        lastHandledTrigger = null;
      }
    });
  });

  let previousActiveTrigger: Element | null = null;

  effect(() => {
    const activeTrigger = popupStore.select("activeTriggerElement");
    const isOpen = popupStore.select("open");
    // One-shot snapshot capture: the values only steer these writes.
    untrack(() => {
      const prev = previousActiveTrigger;
      previousActiveTrigger = isOpen ? (activeTrigger as Element | null) : null;

      // When a trigger changes, set the captured children HTML to state,
      // so we can render both new and old content.
      if (activeTrigger && prev && activeTrigger !== prev && lastHandledTrigger !== activeTrigger && capturedNode) {
        viewportState.previousContentNode = capturedNode;
        viewportState.showStartingStyleAttribute = true;

        // Calculate the relative position between the previous and new trigger,
        // so we can pass it to the style hook for animation purposes.
        const offset = calculateRelativePosition(prev, activeTrigger as Element);
        viewportState.newTriggerOffset = offset;

        lastHandledTrigger = activeTrigger as Element;
      }
    });
  });

  // Arm cleanup after a trigger change, and re-arm it if the current container remounts
  // mid-transition when a lagging payload bumps the content key.
  effect(() => {
    getContentKey();
    previousContentNode();
    // One-shot arming: the values only steer these writes.
    untrack(() => {
      if (viewportState.previousContentNode == null) {
        return;
      }

      // Abort the stale watcher synchronously. The remount cancels the old container's
      // animations, and the resulting promise rejection would otherwise run the cleanup
      // in a microtask before the re-armed watcher below is in place.
      cleanupController?.abort();

      viewportState.showStartingStyleAttribute = true;

      cancelFrame();
      frame = requestAnimationFrame(() => {
        frame = undefined;
        viewportState.showStartingStyleAttribute = false;
        armViewportCleanup();
      });
    });
  });

  // Capture a clone of the current content DOM subtree when not transitioning.
  // We can't store previous nodes as they may be stateful; instead we capture DOM clones for visual continuity.
  effect(() => {
    getContentKey();
    popupStore.select("payload");
    // One-shot capture: the values only re-arm this snapshot.
    untrack(() => {
      // When a transition is in progress, we store the next content in `capturedNode`.
      // This handles the case where the trigger changes multiple times before the transition finishes.
      const source = currentContainer;
      if (!source) {
        return;
      }

      const wrapper = source.ownerDocument.createElement("div");
      for (const child of Array.from(source.childNodes)) {
        wrapper.appendChild(child.cloneNode(true));
      }

      capturedNode = wrapper;
    });
  });

  // When previousContentNode is present, imperatively populate the previous container with the cloned children.
  effect(() => {
    const node = previousContentNode();
    // One-shot population: the value only steers these DOM writes.
    untrack(() => {
      const container = previousContainer;
      if (!container || !node) {
        return;
      }

      container.replaceChildren(...Array.from(node.childNodes));
    });
  });

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
      viewportState.previousContentDimensions = previousDimensions;
    }
  };

  trackPopupAutoResize({
    popupElement: () => popupStore.select("popupElement") as HTMLElement | null,
    positionerElement: () => popupStore.select("positionerElement") as HTMLElement | null,
    mounted: () => popupStore.select("mounted") as boolean,
    content: () => popupStore.select("payload"),
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
              // NB: kebab-case is required. Object styles are applied via `CSSStyleDeclaration.setProperty`,
              // which silently ignores camelCase names.
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

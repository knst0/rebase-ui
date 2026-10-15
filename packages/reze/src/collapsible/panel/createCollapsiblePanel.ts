import { effect, onCleanup, store, untrack } from "reze-js";

import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { TransitionStatus } from "../../internals/transition-status";
import type { CollapsibleRoot } from "../root/CollapsibleRoot";
import * as CollapsiblePanelCssVars from "./CollapsiblePanelCssVars";
import * as CollapsiblePanelDataAttributes from "./CollapsiblePanelDataAttributes";

type AnimationType = "css-transition" | "css-animation" | "none";

interface Dimensions {
  height: number | undefined;
  width: number | undefined;
}

const EMPTY_DIMENSIONS: Dimensions = {
  height: undefined,
  width: undefined,
};

export interface CreateCollapsiblePanelParameters {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   */
  hiddenUntilFound: boolean;
  /**
   * The `id` attribute of the panel.
   */
  id: () => string | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   */
  keepMounted: boolean;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: () => boolean;
  setOpen: (open: boolean) => void;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: () => boolean;
  setMounted: (mounted: boolean) => void;
  transitionStatus: () => TransitionStatus;
}

export interface CreateCollapsiblePanelReturnValue {
  height: () => number | undefined;
  width: () => number | undefined;
  panelElement: () => HTMLElement | null;
  setPanelElement: (element: HTMLElement | null) => void;
  shouldRender: () => boolean;
  transitionStatus: () => TransitionStatus;
}

export function createCollapsiblePanel(parameters: CreateCollapsiblePanelParameters): CreateCollapsiblePanelReturnValue {
  const { hiddenUntilFound, keepMounted, mounted, onOpenChange, open, setMounted, setOpen, transitionStatus } = parameters;

  const state = store({
    panelElement: null as HTMLElement | null,
    animationType: null as AnimationType | null,
    dimensions: { height: undefined, width: undefined } as Dimensions,
    shouldPreventMountAnimation: untrack(open),
    forcePanelIdle: false,
  });

  const machineState = {
    lastMeasuredDimensions: EMPTY_DIMENSIONS as Dimensions,
    shouldSkipNextOpen: false,
    pendingTemporaryStyleRestore: null as (() => void) | null,
  };

  function phase(): "closed" | "measuring" | "opening" | "open" | "closing" {
    if (!open()) {
      return mounted() ? "closing" : "closed";
    }
    if (transitionStatus() === "starting") {
      return "opening";
    }
    if (transitionStatus() === "ending") {
      return "closing";
    }
    return mounted() ? "open" : "measuring";
  }

  function setDimensions(nextDimensions: Dimensions, shouldCacheMeasurement: boolean = true): void {
    if (shouldCacheMeasurement) {
      machineState.lastMeasuredDimensions = nextDimensions;
    }

    state.dimensions = nextDimensions;
  }

  function restorePendingTemporaryStyle(): void {
    machineState.pendingTemporaryStyleRestore?.();
    machineState.pendingTemporaryStyleRestore = null;
  }

  function setPendingTemporaryStyleRestore(restore: () => void): void {
    restorePendingTemporaryStyle();
    machineState.pendingTemporaryStyleRestore = () => {
      machineState.pendingTemporaryStyleRestore = null;
      restore();
    };
  }

  function panelTransitionStatus(): TransitionStatus {
    return state.forcePanelIdle ? "idle" : transitionStatus();
  }

  function shouldPreventOpenAnimation(): boolean {
    return open() && state.shouldPreventMountAnimation;
  }

  function renderedDimensions(): Dimensions {
    const currentDimensions = state.dimensions;

    if (
      !open() &&
      mounted() &&
      untrack(() => state.animationType) === "css-animation" &&
      currentDimensions.height === undefined &&
      currentDimensions.width === undefined
    ) {
      return machineState.lastMeasuredDimensions;
    }

    return currentDimensions;
  }

  // Suppress the mount animation while an initially open panel first renders.
  effect(() => {
    const element = state.panelElement;
    const prevent = shouldPreventOpenAnimation();

    untrack(() => {
      if (element === null || !prevent) {
        return;
      }

      onCleanup(setTemporaryStyle(element, "animation-name", "none"));
    });
  });

  // Publish the measured dimensions as CSS variables for height animations.
  effect(() => {
    const element = state.panelElement;
    const dimensions = renderedDimensions();

    untrack(() => {
      if (element === null) {
        return;
      }

      element.style.setProperty(
        CollapsiblePanelCssVars.collapsiblePanelHeight,
        dimensions.height === undefined ? "auto" : `${dimensions.height}px`,
      );
      element.style.setProperty(
        CollapsiblePanelCssVars.collapsiblePanelWidth,
        dimensions.width === undefined ? "auto" : `${dimensions.width}px`,
      );
    });
  });

  effect(() => {
    const forced = state.forcePanelIdle;
    const status = transitionStatus();

    untrack(() => {
      if (!forced || status === "starting") {
        return;
      }

      state.forcePanelIdle = false;
    });
  });

  const runOnceAnimationsFinished = createAnimationsFinishedRunner(() => state.panelElement);

  let detectedElement: HTMLElement | null = null;
  let detectedPhase: "initial" | "starting" | "ending" | null = null;
  let detectedAnimationType: AnimationType | null = null;

  effect(() => {
    const snapshot = {
      open: open(),
      mounted: mounted(),
      status: transitionStatus(),
      currentPhase: phase(),
      element: state.panelElement,
    };

    untrack(() => {
      const { open: isOpen, mounted: isMounted, status, currentPhase, element } = snapshot;

      // A render function can remove the panel on close. Clear one-shot open animation
      // suppression even without an element, so the next open animates normally.
      if (!isOpen) {
        state.shouldPreventMountAnimation = false;
      }

      if (element === null) {
        // A render function can drop the panel element while it closes. There is nothing left
        // to animate, so finish closing instead of staying in the ending phase.
        //
        // While open, the element is only transiently null (it attaches on flush) or the
        // render function swallowed the ref. Either way, leave mounting to the transition
        // status: unmounting here would ping-pong with its open-and-unmounted branch that
        // mounts right back, starving the flush that attaches the element.
        if (!isOpen) {
          setMounted(false);
        }
        setDimensions(EMPTY_DIMENSIONS, false);
        return;
      }

      if (!isOpen && machineState.pendingTemporaryStyleRestore !== null) {
        restorePendingTemporaryStyle();
      }

      if (detectedElement !== element) {
        detectedElement = element;
        detectedPhase = null;
        detectedAnimationType = null;
      }

      const detectionPhase =
        status === "starting"
          ? "starting"
          : status === "ending"
            ? "ending"
            : isOpen && untrack(() => state.shouldPreventMountAnimation) && status === "idle"
              ? "initial"
              : null;
      if (detectionPhase !== null && detectedPhase !== detectionPhase) {
        detectedPhase = detectionPhase;
        detectedAnimationType = getAnimationType(
          element,
          untrack(() => state.shouldPreventMountAnimation),
        );
      }

      const currentAnimationType =
        detectedAnimationType ??
        getAnimationType(
          element,
          untrack(() => state.shouldPreventMountAnimation),
        );
      detectedAnimationType = currentAnimationType;
      state.animationType = currentAnimationType;

      if (isOpen && status === "idle" && untrack(() => state.shouldPreventMountAnimation) && currentAnimationType === "css-animation") {
        machineState.lastMeasuredDimensions = getDimensions(element);
        return;
      }

      if (currentPhase === "opening") {
        const skipNextOpen = machineState.shouldSkipNextOpen;
        machineState.shouldSkipNextOpen = false;

        if (currentAnimationType === "none") {
          setDimensions(getDimensions(element));
          state.forcePanelIdle = true;
          return;
        }

        if (currentAnimationType === "css-transition") {
          const restoreLayoutStyles = resetLayoutStyles(element);
          setDimensions(getDimensions(element));

          if (!skipNextOpen) {
            onCleanup(restoreLayoutStyles);
            return;
          }

          const restoreTransitionDuration = setTemporaryStyle(element, "transition-duration", "0s");
          setPendingTemporaryStyleRestore(restoreTransitionDuration);
          state.forcePanelIdle = true;
          onCleanup(restoreLayoutStyles);
          return;
        }

        setDimensions(getDimensions(element));

        const restoreAnimationName = setTemporaryStyle(element, "animation-name", "none");
        if (!skipNextOpen) {
          restoreAnimationName();
          return;
        }

        const restoreAnimationDuration = setTemporaryStyle(element, "animation-duration", "0s");

        restoreAnimationName();
        setPendingTemporaryStyleRestore(restoreAnimationDuration);
        state.forcePanelIdle = true;

        return;
      }

      if (!isOpen && isMounted && (status === "idle" || status === "starting")) {
        if (currentAnimationType === "none") {
          setDimensions(EMPTY_DIMENSIONS, false);
          setMounted(false);
          return;
        }

        setDimensions(getDimensions(element));
        return;
      }

      if (currentPhase !== "closing") {
        return;
      }

      if (currentAnimationType === "none") {
        setMounted(false);
        return;
      }

      const nextDimensions = getDimensions(element);
      const hasMeasuredSize = (nextDimensions.height ?? 0) > 0 || (nextDimensions.width ?? 0) > 0;

      if (!hasMeasuredSize) {
        setMounted(false);
        return;
      }

      setDimensions(nextDimensions);

      if (currentAnimationType === "css-animation") {
        setTemporaryStyle(element, "animation-name", "none")();
      }
    });
  });

  effect(() => {
    const enabled = open() && mounted() && panelTransitionStatus() === "idle";
    const element = state.panelElement;

    untrack(() => {
      if (!enabled || element === null) {
        return;
      }

      const abortController = new AbortController();

      runOnceAnimationsFinished(() => {
        if (!untrack(open)) {
          return;
        }

        setDimensions(EMPTY_DIMENSIONS, false);
      }, abortController.signal);

      onCleanup(() => {
        abortController.abort();
      });
    });
  });

  effect(() => {
    const snapshot = {
      isOpen: open(),
      isMounted: mounted(),
      status: panelTransitionStatus(),
      element: state.panelElement,
    };

    untrack(() => {
      const { isOpen, isMounted, status, element } = snapshot;

      if (isOpen || !isMounted || status !== "ending") {
        return;
      }

      if (element === null) {
        // A render function can drop the panel element while it closes. There is nothing left
        // to animate, so finish closing instead of staying in the ending phase.
        setMounted(false);
        setDimensions(EMPTY_DIMENSIONS, false);
        return;
      }

      const abortController = new AbortController();
      let frame: number | undefined = requestAnimationFrame(() => {
        frame = undefined;
        runOnceAnimationsFinished(handleCloseComplete, abortController.signal);
      });

      function handleCloseComplete() {
        if (untrack(open)) {
          return;
        }

        setMounted(false);
        setDimensions(EMPTY_DIMENSIONS, false);
      }

      onCleanup(() => {
        if (frame !== undefined) {
          cancelAnimationFrame(frame);
        }
        abortController.abort();
      });
    });
  });

  effect(() => {
    const element = state.panelElement;

    untrack(() => {
      if (element === null) {
        return;
      }

      const panel = element;
      let revealDecisionTimeout: ReturnType<typeof setTimeout> | undefined;
      let revertRevealFrame = -1;

      const clearRevealTimers = () => {
        if (revealDecisionTimeout !== undefined) {
          clearTimeout(revealDecisionTimeout);
          revealDecisionTimeout = undefined;
        }

        if (revertRevealFrame !== -1) {
          cancelAnimationFrame(revertRevealFrame);
          revertRevealFrame = -1;
        }
      };

      // Reverting must wait until the browser has measured the match, and the render
      // cannot do it: it keeps rendering the same `hidden` and `data-starting-style`
      // props while the panel stays closed, so it never rewrites attributes that were
      // changed behind its back (the browser removes `hidden` as part of the reveal).
      //
      // Whether the open arrived is decided in a task, not a frame: `setOpen` has
      // already scheduled a reactive flush by the time the timeout is queued, so the
      // decision drains after the commit even when a busy main thread delays both,
      // whereas a rendering update could preempt the still-queued commit and make an
      // animation frame read a stale value. When the consumer ignores the open, no
      // commit is ever scheduled and the decision holds. The DOM revert then runs
      // in a frame so it stays atomic with respect to paint.
      const scheduleRevealRevert = (revertSkippedMotion: boolean, restoreStartingStyle: boolean) => {
        clearRevealTimers();

        revealDecisionTimeout = setTimeout(() => {
          revealDecisionTimeout = undefined;

          if (untrack(open)) {
            return;
          }

          revertRevealFrame = requestAnimationFrame(() => {
            revertRevealFrame = -1;

            if (untrack(open)) {
              return;
            }

            if (revertSkippedMotion) {
              // The open never happened, so the next one is an ordinary open that
              // should keep its author-defined motion.
              machineState.shouldSkipNextOpen = false;
            }

            if (restoreStartingStyle) {
              panel.setAttribute(CollapsiblePanelDataAttributes.startingStyle, "");
            }

            panel.setAttribute("hidden", "until-found");
          });
        }, 0);
      };

      const handleBeforeMatch = (event: Event) => {
        const eventDetails = createChangeEventDetails(REASONS.none, event);

        onOpenChange(true, eventDetails);

        if (eventDetails.isCanceled) {
          // A canceled reveal means the panel must stay hidden, so undo the
          // browser's removal of `hidden` and keep the content searchable.
          scheduleRevealRevert(false, false);
          return;
        }

        machineState.shouldSkipNextOpen = true;

        // The browser removes `hidden` and measures the match in the same task that
        // dispatches this event, while the state update below only lands in a
        // later one. Panels kept collapsed by persisted starting styles would still
        // be zero-sized at that point and the match highlight is dropped, so drop
        // those styles synchronously here.
        const hadStartingStyle = panel.hasAttribute(CollapsiblePanelDataAttributes.startingStyle);
        panel.removeAttribute(CollapsiblePanelDataAttributes.startingStyle);

        setOpen(true);

        // A controlled panel whose `onOpenChange` is ignored never receives the open
        // state, so return it to the fully closed state once the browser has measured.
        scheduleRevealRevert(true, hadStartingStyle);
      };

      panel.addEventListener("beforematch", handleBeforeMatch);

      onCleanup(() => {
        clearRevealTimers();
        panel.removeEventListener("beforematch", handleBeforeMatch);
      });
    });
  });

  function shouldRender(): boolean {
    return keepMounted || hiddenUntilFound || mounted() || open();
  }

  function panelElement(): HTMLElement | null {
    return state.panelElement;
  }

  function setPanelElement(element: HTMLElement | null): void {
    state.panelElement = element;
  }

  return {
    height: () => renderedDimensions().height,
    width: () => renderedDimensions().width,
    panelElement,
    setPanelElement,
    shouldRender,
    transitionStatus: panelTransitionStatus,
  };
}

function getDimensions(element: HTMLElement): Dimensions {
  return {
    height: element.scrollHeight,
    width: element.scrollWidth,
  };
}

function getAnimationType(element: HTMLElement, hasSuppressedMountAnimation: boolean): AnimationType {
  const view = element.ownerDocument.defaultView ?? window;
  const panelStyles = view.getComputedStyle(element);
  const hasAnimation =
    (panelStyles.animationName
      .split(",")
      .map((name) => name.trim())
      .some((name) => name !== "" && name !== "none") ||
      hasSuppressedMountAnimation) &&
    hasNonZeroDuration(panelStyles.animationDuration);
  const hasTransition = hasNonZeroDuration(panelStyles.transitionDuration);

  if (hasAnimation && hasTransition) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "Rebase UI: CSS transitions and CSS animations are both detected on a Collapsible panel. Only one of either animation type should be used.",
      );
    }

    return "css-transition";
  }

  if (hasTransition) {
    return "css-transition";
  }

  if (hasAnimation) {
    return "css-animation";
  }

  return "none";
}

function hasNonZeroDuration(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .some((part) => part !== "" && Number.parseFloat(part) > 0);
}

/**
 * Temporarily overrides an inline style property and returns a cleanup that
 * restores the previous inline value and priority.
 */
function setTemporaryStyle(element: HTMLElement, property: string, value: string): () => void {
  const previousValue = element.style.getPropertyValue(property);
  const previousPriority = element.style.getPropertyPriority(property);

  element.style.setProperty(property, value);

  return () => {
    if (previousValue === "") {
      element.style.removeProperty(property);
      return;
    }

    element.style.setProperty(property, previousValue, previousPriority);
  };
}

/**
 * Temporarily resets inline alignment styles that can distort scroll-based
 * size measurements, then restores them on the next animation frame.
 */
function resetLayoutStyles(element: HTMLElement): () => void {
  const originalLayoutStyles: Record<string, string> = {
    "justify-content": element.style.justifyContent,
    "align-items": element.style.alignItems,
    "align-content": element.style.alignContent,
    "justify-items": element.style.justifyItems,
  };

  for (const key of Object.keys(originalLayoutStyles)) {
    element.style.setProperty(key, "initial", "important");
  }

  function restoreLayoutStyles() {
    for (const [key, value] of Object.entries(originalLayoutStyles)) {
      if (value === "") {
        element.style.removeProperty(key);
        continue;
      }

      element.style.setProperty(key, value);
    }
  }

  const frame = requestAnimationFrame(restoreLayoutStyles);

  return () => {
    cancelAnimationFrame(frame);
    restoreLayoutStyles();
  };
}

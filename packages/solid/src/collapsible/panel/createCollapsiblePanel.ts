import { type Accessor, createEffect, createMemo, createRenderEffect, createSignal, type Setter, untrack } from "solid-js";

import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { TransitionStatus } from "../../internals/transition-status";
import { CollapsibleRoot } from "../root/CollapsibleRoot";
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
  id: Accessor<string | undefined>;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   */
  keepMounted: boolean;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: Accessor<boolean>;
  setOpen: (open: boolean) => void;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: Accessor<boolean>;
  setMounted: Setter<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
}

export interface CreateCollapsiblePanelReturnValue {
  height: Accessor<number | undefined>;
  width: Accessor<number | undefined>;
  panelElement: Accessor<HTMLElement | null>;
  props: Record<string, any>;
  setPanelElement: (element: HTMLElement | null) => void;
  shouldPersistHiddenTransitionStyles: () => boolean;
  shouldRender: () => boolean;
  transitionStatus: Accessor<TransitionStatus>;
}

const PERSISTED_STARTING_HOOK = { [CollapsiblePanelDataAttributes.startingStyle]: "" };
const PERSISTED_ENDING_HOOK = { [CollapsiblePanelDataAttributes.endingStyle]: "" };

/**
 * Transition-status mapping that additionally persists `data-starting-style`
 * on closed `hiddenUntilFound` panels (upstream
 * `shouldPersistHiddenTransitionStyles`). The persist read stays inside `map`,
 * so state-attribute applies subscribe to it like any other state derivation.
 */
export function createPanelTransitionStatusMapping(
  shouldPersistHiddenTransitionStyles: () => boolean,
): StateAttributesMapping<{ transitionStatus: TransitionStatus }> {
  return {
    transitionStatus: {
      keys: [CollapsiblePanelDataAttributes.startingStyle, CollapsiblePanelDataAttributes.endingStyle],
      map: (value) => {
        if (value === "starting") {
          return PERSISTED_STARTING_HOOK;
        }

        if (value === "ending") {
          return PERSISTED_ENDING_HOOK;
        }

        if (shouldPersistHiddenTransitionStyles()) {
          return PERSISTED_STARTING_HOOK;
        }

        return null;
      },
    },
  };
}

export function createCollapsiblePanel(parameters: CreateCollapsiblePanelParameters): CreateCollapsiblePanelReturnValue {
  const { hiddenUntilFound, keepMounted, mounted, onOpenChange, open, setMounted, setOpen, transitionStatus } = parameters;

  const [panelElement, setPanelElement] = createSignal<HTMLElement | null>(null);

  const [animationType, setAnimationType] = createSignal<AnimationType | null>(null);
  const [dimensions, setDimensionsState] = createSignal<Dimensions>(EMPTY_DIMENSIONS);

  const machineState = {
    lastMeasuredDimensions: EMPTY_DIMENSIONS,
    shouldSkipNextOpen: false,
    pendingTemporaryStyleRestore: null as (() => void) | null,
  };

  const [shouldPreventMountAnimation, setShouldPreventMountAnimation] = createSignal(untrack(open));
  const [forcePanelIdle, setForcePanelIdle] = createSignal(false);

  const phase = createMemo<"closed" | "measuring" | "opening" | "open" | "closing">(() => {
    if (!open()) return mounted() ? "closing" : "closed";
    if (transitionStatus() === "starting") return "opening";
    if (transitionStatus() === "ending") return "closing";
    return mounted() ? "open" : "measuring";
  });

  const setDimensions = (nextDimensions: Dimensions, shouldCacheMeasurement: boolean = true) => {
    if (shouldCacheMeasurement) {
      machineState.lastMeasuredDimensions = nextDimensions;
    }

    setDimensionsState(nextDimensions);
  };

  const restorePendingTemporaryStyle = () => {
    machineState.pendingTemporaryStyleRestore?.();
    machineState.pendingTemporaryStyleRestore = null;
  };

  const setPendingTemporaryStyleRestore = (restore: () => void) => {
    restorePendingTemporaryStyle();
    machineState.pendingTemporaryStyleRestore = () => {
      machineState.pendingTemporaryStyleRestore = null;
      restore();
    };
  };

  const panelTransitionStatus = () => (forcePanelIdle() ? "idle" : transitionStatus());

  // Upstream `shouldPersistHiddenTransitionStyles`: a closed `hiddenUntilFound`
  // panel keeps its collapsed starting styles (keyframe panels drop them once
  // the animation type is detected) so a find-in-page reveal never flashes at
  // full height before the open commits. `handleBeforeMatch` still drops the
  // attribute synchronously so the browser can measure the match.
  const shouldPersistHiddenTransitionStyles = () => hiddenUntilFound && !open() && !mounted() && animationType() !== "css-animation";

  const shouldPreventOpenAnimation = createMemo(() => open() && shouldPreventMountAnimation());

  createRenderEffect(
    () => ({ element: panelElement(), prevent: shouldPreventOpenAnimation() }),
    ({ element, prevent }) => {
      if (element === null || !prevent) return;
      return setTemporaryStyle(element, "animation-name", "none");
    },
  );

  const renderedDimensions = createMemo<Dimensions>(() => {
    const currentDimensions = dimensions();

    if (
      !open() &&
      mounted() &&
      untrack(animationType) === "css-animation" &&
      currentDimensions.height === undefined &&
      currentDimensions.width === undefined
    ) {
      return machineState.lastMeasuredDimensions;
    }

    return currentDimensions;
  });

  createRenderEffect(
    () => ({ element: panelElement(), dimensions: renderedDimensions() }),
    ({ element, dimensions }) => {
      if (element === null) return;
      element.style.setProperty(
        CollapsiblePanelCssVars.collapsiblePanelHeight,
        dimensions.height === undefined ? "auto" : `${dimensions.height}px`,
      );
      element.style.setProperty(
        CollapsiblePanelCssVars.collapsiblePanelWidth,
        dimensions.width === undefined ? "auto" : `${dimensions.width}px`,
      );
    },
  );

  createEffect(
    () => ({ forced: forcePanelIdle(), status: transitionStatus() }),
    ({ forced, status }) => {
      if (!forced || status === "starting") {
        return undefined;
      }

      setForcePanelIdle(false);
      return undefined;
    },
  );

  const runOnceAnimationsFinished = createAnimationsFinishedRunner(panelElement);

  let detectedElement: HTMLElement | null = null;
  let detectedPhase: "initial" | "starting" | "ending" | null = null;
  let detectedAnimationType: AnimationType | null = null;

  createEffect(
    () => ({
      open: open(),
      mounted: mounted(),
      status: transitionStatus(),
      phase: phase(),
      element: panelElement(),
    }),
    ({ open, mounted, status, phase: currentPhase, element }) => {
      // A render function can remove the panel on close. Clear one-shot open animation
      // suppression even without an element, so the next open animates normally.
      if (!open) {
        setShouldPreventMountAnimation(false);
      }

      if (element === null) {
        // A render function can drop the panel element while it closes. There is nothing left
        // to animate, so finish closing instead of staying in the ending phase.
        setMounted(false);
        setDimensions(EMPTY_DIMENSIONS, false);
        return undefined;
      }

      if (!open && machineState.pendingTemporaryStyleRestore !== null) {
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
            : open && untrack(shouldPreventMountAnimation) && status === "idle"
              ? "initial"
              : null;
      if (detectionPhase !== null && detectedPhase !== detectionPhase) {
        detectedPhase = detectionPhase;
        detectedAnimationType = getAnimationType(element, untrack(shouldPreventMountAnimation));
      }

      const currentAnimationType = detectedAnimationType ?? getAnimationType(element, untrack(shouldPreventMountAnimation));
      detectedAnimationType = currentAnimationType;
      setAnimationType(currentAnimationType);

      if (open && status === "idle" && untrack(shouldPreventMountAnimation) && currentAnimationType === "css-animation") {
        machineState.lastMeasuredDimensions = getDimensions(element);
        return undefined;
      }

      if (currentPhase === "opening") {
        const skipNextOpen = machineState.shouldSkipNextOpen;
        machineState.shouldSkipNextOpen = false;

        if (currentAnimationType === "none") {
          setDimensions(getDimensions(element));
          setForcePanelIdle(true);
          return undefined;
        }

        if (currentAnimationType === "css-transition") {
          const restoreLayoutStyles = resetLayoutStyles(element);
          setDimensions(getDimensions(element));

          if (!skipNextOpen) {
            return restoreLayoutStyles;
          }

          const restoreTransitionDuration = setTemporaryStyle(element, "transition-duration", "0s");
          setPendingTemporaryStyleRestore(restoreTransitionDuration);
          setForcePanelIdle(true);
          return restoreLayoutStyles;
        }

        setDimensions(getDimensions(element));

        const restoreAnimationName = setTemporaryStyle(element, "animation-name", "none");
        if (!skipNextOpen) {
          restoreAnimationName();
          return undefined;
        }

        const restoreAnimationDuration = setTemporaryStyle(element, "animation-duration", "0s");

        restoreAnimationName();
        setPendingTemporaryStyleRestore(restoreAnimationDuration);
        setForcePanelIdle(true);

        return undefined;
      }

      if (!open && mounted && (status === "idle" || status === "starting")) {
        if (currentAnimationType === "none") {
          setDimensions(EMPTY_DIMENSIONS, false);
          setMounted(false);
          return undefined;
        }

        setDimensions(getDimensions(element));
        return undefined;
      }

      if (currentPhase !== "closing") {
        return undefined;
      }

      if (currentAnimationType === "none") {
        setMounted(false);
        return undefined;
      }

      const nextDimensions = getDimensions(element);
      const hasMeasuredSize = (nextDimensions.height ?? 0) > 0 || (nextDimensions.width ?? 0) > 0;

      if (!hasMeasuredSize) {
        setMounted(false);
        return undefined;
      }

      setDimensions(nextDimensions);

      if (currentAnimationType === "css-animation") {
        setTemporaryStyle(element, "animation-name", "none")();
      }

      return undefined;
    },
  );

  createEffect(
    () => ({ enabled: open() && mounted() && panelTransitionStatus() === "idle", element: panelElement() }),
    ({ enabled, element }) => {
      if (!enabled || element === null) {
        return undefined;
      }

      const abortController = new AbortController();

      runOnceAnimationsFinished(() => {
        if (!untrack(open)) {
          return;
        }

        setDimensions(EMPTY_DIMENSIONS, false);
      }, abortController.signal);

      return () => {
        abortController.abort();
      };
    },
  );

  createEffect(
    () => ({ isOpen: open(), isMounted: mounted(), status: panelTransitionStatus(), element: panelElement() }),
    ({ isOpen, isMounted, status, element }) => {
      if (isOpen || !isMounted || status !== "ending") {
        return undefined;
      }

      if (element === null) {
        // A render function can drop the panel element while it closes. There is nothing left
        // to animate, so finish closing instead of staying in the ending phase.
        setMounted(false);
        setDimensions(EMPTY_DIMENSIONS, false);
        return undefined;
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

      return () => {
        if (frame !== undefined) {
          cancelAnimationFrame(frame);
        }
        abortController.abort();
      };
    },
  );

  createEffect(
    () => ({ element: panelElement() }),
    ({ element }) => {
      if (element === null) {
        return undefined;
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

      return () => {
        clearRevealTimers();
        panel.removeEventListener("beforematch", handleBeforeMatch);
      };
    },
  );

  const shouldRender = () => keepMounted || hiddenUntilFound || mounted() || open();

  return {
    height: () => renderedDimensions().height,
    width: () => renderedDimensions().width,
    props: {
      get hidden() {
        if (!open() && !mounted()) {
          return hiddenUntilFound ? ("until-found" as const) : true;
        }
        return undefined;
      },
      get id() {
        return parameters.id();
      },
    },
    setPanelElement,
    panelElement,
    shouldPersistHiddenTransitionStyles,
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

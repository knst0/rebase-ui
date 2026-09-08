import { type Accessor, createEffect, createMemo, createRenderEffect, createSignal, type Setter, untrack } from "solid-js";

import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { TransitionStatus } from "../../internals/transition-status";
import { CollapsibleRoot } from "../root/CollapsibleRoot";
import * as CollapsiblePanelCssVars from "./CollapsiblePanelCssVars";

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
  shouldRender: () => boolean;
  transitionStatus: Accessor<TransitionStatus>;
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
      if (element === null) {
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
        setShouldPreventMountAnimation(false);

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
      if (isOpen || !isMounted || status !== "ending" || element === null) {
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

      const handleBeforeMatch = (event: Event) => {
        const eventDetails = createChangeEventDetails(REASONS.none, event);

        onOpenChange(true, eventDetails);

        if (eventDetails.isCanceled) {
          return;
        }

        machineState.shouldSkipNextOpen = true;
        setOpen(true);
      };

      element.addEventListener("beforematch", handleBeforeMatch);

      return () => {
        element.removeEventListener("beforematch", handleBeforeMatch);
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

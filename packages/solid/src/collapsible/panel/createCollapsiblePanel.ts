import { type Accessor, createEffect, createMemo, createSignal, type Setter, untrack } from "solid-js";

import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { TransitionStatus } from "../../internals/transition-status";
import type { CollapsibleRootChangeEventDetails } from "../root/CollapsibleRoot";

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
  hiddenUntilFound: Accessor<boolean>;
  id: Accessor<string | undefined>;
  keepMounted: Accessor<boolean>;
  mounted: Accessor<boolean>;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void;
  open: Accessor<boolean>;
  setMounted: Setter<boolean>;
  setOpen: (open: boolean) => void;
  transitionStatus: Accessor<TransitionStatus>;
}

export interface CreateCollapsiblePanelReturnValue {
  height: Accessor<number | undefined>;
  width: Accessor<number | undefined>;
  props: Record<string, any>;
  ref: (element: HTMLElement | null) => void;
  shouldRender: () => boolean;
  shouldPreventOpenAnimation: Accessor<boolean>;
  shouldPersistHiddenTransitionStyles: () => boolean;
  transitionStatus: Accessor<TransitionStatus>;
}

export function createCollapsiblePanel(parameters: CreateCollapsiblePanelParameters): CreateCollapsiblePanelReturnValue {
  const { hiddenUntilFound, keepMounted, mounted, onOpenChange, open, setMounted, setOpen, transitionStatus } = parameters;

  const [panelElement, setPanelElement] = createSignal<HTMLElement | null>(null);
  const [animationType, setAnimationType] = createSignal<AnimationType | null>(null);
  const [dimensions, setDimensionsState] = createSignal<Dimensions>(EMPTY_DIMENSIONS);

  let lastMeasuredDimensions: Dimensions = EMPTY_DIMENSIONS;

  let shouldSkipNextOpen = false;

  const [shouldPreventMountAnimation, setShouldPreventMountAnimation] = createSignal(untrack(open));

  const [forcePanelIdle, setForcePanelIdle] = createSignal(false);
  let pendingTemporaryStyleRestore: (() => void) | null = null;

  const setDimensions = (nextDimensions: Dimensions, shouldCacheMeasurement: boolean = true) => {
    if (shouldCacheMeasurement) {
      lastMeasuredDimensions = nextDimensions;
    }

    setDimensionsState(nextDimensions);
  };

  const restorePendingTemporaryStyle = () => {
    pendingTemporaryStyleRestore?.();
    pendingTemporaryStyleRestore = null;
  };

  const setPendingTemporaryStyleRestore = (restore: () => void) => {
    restorePendingTemporaryStyle();
    pendingTemporaryStyleRestore = () => {
      pendingTemporaryStyleRestore = null;
      restore();
    };
  };

  const hidden = () => !open() && !mounted();

  const panelTransitionStatus = () => (forcePanelIdle() ? "idle" : transitionStatus());

  const shouldPreventOpenAnimation = createMemo(() => open() && shouldPreventMountAnimation());

  const renderedDimensions = createMemo<Dimensions>(() => {
    const currentDimensions = dimensions();

    if (
      !open() &&
      mounted() &&
      untrack(animationType) === "css-animation" &&
      currentDimensions.height === undefined &&
      currentDimensions.width === undefined
    ) {
      return lastMeasuredDimensions;
    }

    return currentDimensions;
  });

  const shouldPersistHiddenTransitionStyles = () => hiddenUntilFound() && hidden() && untrack(animationType) !== "css-animation";

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

  const runOnceOpenAnimationsFinished = createAnimationsFinishedRunner(panelElement);
  const runOnceCloseAnimationsFinished = createAnimationsFinishedRunner(panelElement);

  createEffect(
    () => ({
      open: open(),
      mounted: mounted(),
      status: transitionStatus(),
      element: panelElement(),
    }),
    ({ open, mounted, status, element }) => {
      if (element === null) {
        return undefined;
      }

      if (!open && pendingTemporaryStyleRestore !== null) {
        restorePendingTemporaryStyle();
      }

      const currentAnimationType = getAnimationType(element, untrack(shouldPreventMountAnimation));
      setAnimationType(currentAnimationType);

      if (open && status === "idle" && untrack(shouldPreventMountAnimation) && currentAnimationType === "css-animation") {
        lastMeasuredDimensions = getDimensions(element);
        return undefined;
      }

      if (open && status === "starting") {
        const skipNextOpen = shouldSkipNextOpen;
        shouldSkipNextOpen = false;

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

      if (status !== "ending") {
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

      runOnceOpenAnimationsFinished(() => {
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
        runOnceCloseAnimationsFinished(handleCloseComplete, abortController.signal);
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

        shouldSkipNextOpen = true;
        setOpen(true);
      };

      element.addEventListener("beforematch", handleBeforeMatch);

      return () => {
        element.removeEventListener("beforematch", handleBeforeMatch);
      };
    },
  );

  const shouldRender = () => keepMounted() || hiddenUntilFound() || mounted() || open();

  return {
    height: () => renderedDimensions().height,
    width: () => renderedDimensions().width,
    props: {
      get hidden() {
        if (!open() && !mounted()) {
          return hiddenUntilFound() ? ("until-found" as const) : true;
        }
        return undefined;
      },
      get id() {
        return parameters.id();
      },
    },
    ref: setPanelElement,
    shouldRender,
    shouldPreventOpenAnimation,
    shouldPersistHiddenTransitionStyles,
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

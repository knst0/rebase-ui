import { createEffect, createMemo, createRenderEffect, createSignal, untrack } from "solid-js";

import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import * as CollapsiblePanelCssVars from "./CollapsiblePanelCssVars";
import {
  type AnimationType,
  type Dimensions,
  EMPTY_DIMENSIONS,
  getAnimationType,
  getDimensions,
  type PanelStrategyParameters,
  type PanelStrategyReturnValue,
  resetLayoutStyles,
  setTemporaryStyle,
} from "./panelStrategy";

export function measuredSizeStrategy(parameters: PanelStrategyParameters): PanelStrategyReturnValue {
  const { mounted, open, panelElement, setMounted, transitionStatus } = parameters;

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

  return {
    height: () => renderedDimensions().height,
    width: () => renderedDimensions().width,
    transitionStatus: panelTransitionStatus,
    notifyOpenedByFind: () => {
      machineState.shouldSkipNextOpen = true;
    },
  };
}

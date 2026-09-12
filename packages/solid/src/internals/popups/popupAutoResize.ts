import { createEffect, onCleanup, untrack } from "solid-js";

import type { Side } from "../anchor-positioning/createAnchorPositioning";
import { createAnimationsFinishedRunner } from "../createAnimationsFinishedRunner";
import { getCssDimensions, type Dimensions } from "../utils/getCssDimensions";

export interface PopupAutoResizeParameters {
  popupElement: () => HTMLElement | null;
  positionerElement: () => HTMLElement | null;
  mounted: () => boolean;
  /**
   * Content that may change and trigger a resize. This doesn't have to be the actual content
   * of the popup, but a value that triggers a resize.
   */
  content: () => unknown;
  onMeasureLayout?: (() => void) | undefined;
  onMeasureLayoutComplete?: ((previousDimensions: Dimensions | null, newDimensions: Dimensions) => void) | undefined;
  side: () => Side;
  direction: "ltr" | "rtl";
}

const POPUP_WIDTH_VAR = "--popup-width";
const POPUP_HEIGHT_VAR = "--popup-height";
const POSITIONER_WIDTH_VAR = "--positioner-width";
const POSITIONER_HEIGHT_VAR = "--positioner-height";
const AVAILABLE_WIDTH_VAR = "--available-width";
const AVAILABLE_HEIGHT_VAR = "--available-height";

/**
 * Allows the element to automatically resize based on its content while supporting animations.
 * Ported from Base UI `utils/usePopupAutoResize.ts`.
 */
export function trackPopupAutoResize(parameters: PopupAutoResizeParameters) {
  const { onMeasureLayout, onMeasureLayoutComplete } = parameters;

  const runOnceAnimationsFinish = createAnimationsFinishedRunner(
    () => parameters.popupElement(),
    () => false,
  );

  let frame: number | undefined;
  const cancelFrame = () => {
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
  };
  onCleanup(cancelFrame);

  let committedDimensions: Dimensions | null = null;
  let isInitialRender = true;

  let restoreAnchoringStyles: () => void = () => {};

  function getPopupAnchoringStyles(side: Side, direction: "ltr" | "rtl"): Record<string, string> {
    // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or `right` (side=left).
    const isPhysicalTop = side === "top";
    const isPhysicalLeft = side === "left" || side === (direction === "rtl" ? "inline-end" : "inline-start");

    if (!isPhysicalTop && !isPhysicalLeft) {
      return {};
    }

    return {
      position: "absolute",
      [isPhysicalTop ? "bottom" : "top"]: "0",
      [isPhysicalLeft ? "right" : "left"]: "0",
    };
  }

  createEffect(
    () => ({
      content: parameters.content(),
      popupElement: parameters.popupElement(),
      positionerElement: parameters.positionerElement(),
      isMounted: parameters.mounted(),
      side: parameters.side(),
    }),
    ({ content, popupElement, positionerElement, isMounted, side }) => {
      void content;
      // Reset the state when the popup is closed.
      if (!isMounted) {
        restoreAnchoringStyles();
        restoreAnchoringStyles = () => {};
        isInitialRender = true;
        committedDimensions = null;
        return undefined;
      }

      if (!popupElement || !positionerElement) {
        return undefined;
      }

      const anchoringStyles = getPopupAnchoringStyles(side, parameters.direction);

      restoreAnchoringStyles = applyElementStyles(popupElement, anchoringStyles);

      // Measure the rendered size to enable transitions:
      setPopupCssSize(popupElement, "auto");

      const restorePopupPosition = overrideElementStyle(popupElement, "position", "static");
      const restorePopupTransform = overrideElementStyle(popupElement, "transform", "none");
      const restorePopupScale = overrideElementStyle(popupElement, "scale", "1");
      const restorePositionerAvailableSize = applyElementStyles(positionerElement, {
        [AVAILABLE_WIDTH_VAR]: "max-content",
        [AVAILABLE_HEIGHT_VAR]: "max-content",
      });

      function restoreMeasurementOverrides() {
        restorePopupPosition();
        restorePopupTransform();
        restorePositionerAvailableSize();
      }

      function restoreMeasurementOverridesIncludingScale() {
        restoreMeasurementOverrides();
        restorePopupScale();
      }

      onMeasureLayout?.();

      // Initial render (for each time the popup opens).
      if (isInitialRender || committedDimensions === null) {
        setPositionerCssSize(positionerElement, "max-content");

        const dimensions = getCssDimensions(popupElement);

        committedDimensions = dimensions;

        setPositionerCssSize(positionerElement, dimensions);
        restoreMeasurementOverridesIncludingScale();
        onMeasureLayoutComplete?.(null, dimensions);

        isInitialRender = false;

        return () => {
          restoreAnchoringStyles();
          restoreAnchoringStyles = () => {};
        };
      }

      // Subsequent renders while open (when `content` changes).
      setPositionerCssSize(positionerElement, "max-content");

      const previousDimensions = committedDimensions;
      const newDimensions = getCssDimensions(popupElement);

      // Commit immediately so future content changes have a stable previous size.
      committedDimensions = newDimensions;

      setPopupCssSize(popupElement, previousDimensions);
      restoreMeasurementOverridesIncludingScale();
      onMeasureLayoutComplete?.(previousDimensions, newDimensions);

      setPositionerCssSize(positionerElement, newDimensions);

      const abortController = new AbortController();

      cancelFrame();
      frame = requestAnimationFrame(() => {
        frame = undefined;
        setPopupCssSize(popupElement, newDimensions);

        runOnceAnimationsFinish(() => {
          untrack(() => {
            popupElement.style.setProperty(POPUP_WIDTH_VAR, "auto");
            popupElement.style.setProperty(POPUP_HEIGHT_VAR, "auto");
          });
        }, abortController.signal);
      });

      return () => {
        abortController.abort();
        cancelFrame();
        restoreAnchoringStyles();
        restoreAnchoringStyles = () => {};
      };
    },
  );
}

function overrideElementStyle(element: HTMLElement, property: string, value: string) {
  const originalValue = element.style.getPropertyValue(property);
  element.style.setProperty(property, value);

  return () => {
    element.style.setProperty(property, originalValue);
  };
}

function applyElementStyles(element: HTMLElement, styles: Record<string, string>) {
  const restorers: Array<() => void> = [];

  for (const [key, value] of Object.entries(styles)) {
    restorers.push(overrideElementStyle(element, key, value));
  }

  return restorers.length
    ? () => {
        restorers.forEach((restore) => restore());
      }
    : () => {};
}

function setPopupCssSize(popupElement: HTMLElement, size: Dimensions | "auto") {
  const width = size === "auto" ? "auto" : `${size.width}px`;
  const height = size === "auto" ? "auto" : `${size.height}px`;
  popupElement.style.setProperty(POPUP_WIDTH_VAR, width);
  popupElement.style.setProperty(POPUP_HEIGHT_VAR, height);
}

function setPositionerCssSize(positionerElement: HTMLElement, size: Dimensions | "max-content") {
  const width = size === "max-content" ? "max-content" : `${size.width}px`;
  const height = size === "max-content" ? "max-content" : `${size.height}px`;
  positionerElement.style.setProperty(POSITIONER_WIDTH_VAR, width);
  positionerElement.style.setProperty(POSITIONER_HEIGHT_VAR, height);
}

export type { Dimensions };

import type { Accessor, Setter } from "solid-js";

import type { TransitionStatus } from "../../internals/transition-status";

export type AnimationType = "css-transition" | "css-animation" | "none";

export interface Dimensions {
  height: number | undefined;
  width: number | undefined;
}

export const EMPTY_DIMENSIONS: Dimensions = {
  height: undefined,
  width: undefined,
};

export interface PanelStrategyParameters {
  mounted: Accessor<boolean>;
  open: Accessor<boolean>;
  setMounted: Setter<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
  panelElement: Accessor<HTMLElement | null>;
}

export interface PanelStrategyReturnValue {
  height: Accessor<number | undefined>;
  width: Accessor<number | undefined>;
  transitionStatus: Accessor<TransitionStatus>;
  notifyOpenedByFind: () => void;
}

export type PanelStrategy = (parameters: PanelStrategyParameters) => PanelStrategyReturnValue;

export function supportsInterpolateSize(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("interpolate-size: allow-keywords");
}

export function isNativeSizingEnabled(): boolean {
  return Boolean(globalThis.REBASE_UI_EXPERIMENTAL_NATIVE_SIZING) && supportsInterpolateSize();
}

export function getDimensions(element: HTMLElement): Dimensions {
  return {
    height: element.scrollHeight,
    width: element.scrollWidth,
  };
}

export function getAnimationType(element: HTMLElement, hasSuppressedMountAnimation: boolean): AnimationType {
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
export function setTemporaryStyle(element: HTMLElement, property: string, value: string): () => void {
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
export function resetLayoutStyles(element: HTMLElement): () => void {
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

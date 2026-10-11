import type { CompositeOrientation, TextDirection } from "../composite";

export interface CompositeScrollOptions {
  container: HTMLElement | null;
  element: HTMLElement | null;
  direction: TextDirection;
  orientation: CompositeOrientation;
}

export type CompositeScrollBehavior = (options: CompositeScrollOptions) => void;

/**
 * Native `scrollIntoView({ block: 'nearest' })` behavior. Unlike the default
 * `preciseScrollBehavior`, the browser also scrolls every scrollable ancestor —
 * including the page — so only opt in when page-level scrolling is wanted.
 */
export const nearestScrollBehavior: CompositeScrollBehavior = ({ element }) => {
  if (element === null || typeof element.scrollIntoView !== "function") {
    return;
  }
  element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
};

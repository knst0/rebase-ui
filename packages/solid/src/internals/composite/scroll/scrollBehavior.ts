import type { CompositeOrientation, TextDirection } from "../composite";

export interface CompositeScrollOptions {
  container: HTMLElement | null;
  element: HTMLElement | null;
  direction: TextDirection;
  orientation: CompositeOrientation;
}

export type CompositeScrollBehavior = (options: CompositeScrollOptions) => void;

/**
 * Default scroll behavior. Delegates to the browser, which already honors
 * `scroll-margin` and `scroll-padding` and performs no layout reads from JS.
 */
export const nearestScrollBehavior: CompositeScrollBehavior = ({ element }) => {
  if (element === null || typeof element.scrollIntoView !== "function") {
    return;
  }
  element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
};

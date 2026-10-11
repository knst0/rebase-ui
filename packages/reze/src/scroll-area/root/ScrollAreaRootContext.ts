import { createContext, useContext } from "reze-js";

import type { Coords, HiddenState, OverflowEdges, ScrollAreaRoot, Size } from "./ScrollAreaRoot";

export interface ScrollAreaRootContext {
  cornerSize: () => Size;
  setCornerSize: (next: Size) => void;
  thumbSize: () => Size;
  setThumbSize: (next: Size) => void;
  hasMeasuredScrollbar: () => boolean;
  setHasMeasuredScrollbar: (next: boolean) => void;
  touchModality: () => boolean;
  hovering: () => boolean;
  setHovering: (next: boolean) => void;
  scrollingX: () => boolean;
  scrollingY: () => boolean;
  rootElement: () => HTMLElement | null;
  setRootElement: (element: HTMLElement | null) => void;
  viewportElement: () => HTMLElement | null;
  setViewportElement: (element: HTMLElement | null) => void;
  scrollbarYElement: () => HTMLElement | null;
  setScrollbarYElement: (element: HTMLElement | null) => void;
  scrollbarXElement: () => HTMLElement | null;
  setScrollbarXElement: (element: HTMLElement | null) => void;
  thumbYElement: () => HTMLElement | null;
  setThumbYElement: (element: HTMLElement | null) => void;
  thumbXElement: () => HTMLElement | null;
  setThumbXElement: (element: HTMLElement | null) => void;
  cornerElement: () => HTMLElement | null;
  setCornerElement: (element: HTMLElement | null) => void;
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handlePointerEnterOrMove: (event: PointerEvent) => void;
  handleTouchModalityChange: (event: PointerEvent) => void;
  handlePointerLeave: () => void;
  handleScroll: (scrollPosition: Coords) => void;
  disableViewportSnap: () => void;
  hiddenState: () => HiddenState;
  setHiddenState: (next: HiddenState) => void;
  overflowEdges: () => OverflowEdges;
  setOverflowEdges: (next: OverflowEdges) => void;
  /**
   * Builds a plain-object snapshot of the root state for render props
   * (`class`/`style`/`children` functions). Call it inside a tracking scope
   * (JSX binding, content thunk) so the binding subscribes to state changes.
   */
  rootStateSnapshot: () => ScrollAreaRoot.State;
  overflowEdgeThreshold: {
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
  };
}

export const ScrollAreaRootContext = createContext<ScrollAreaRootContext | undefined>(undefined);

export function useScrollAreaRootContext(optional?: false): ScrollAreaRootContext;
export function useScrollAreaRootContext(optional: true): ScrollAreaRootContext | undefined;
export function useScrollAreaRootContext(optional?: boolean): ScrollAreaRootContext | undefined {
  const context = useContext(ScrollAreaRootContext);

  if (!optional && context === undefined) {
    throw new Error("Rebase UI: ScrollAreaRootContext is missing. ScrollArea parts must be placed within <ScrollArea.Root>.");
  }

  return context;
}

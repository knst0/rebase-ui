import type { Accessor, Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { Coords, HiddenState, OverflowEdges, ScrollAreaRoot, Size } from "./ScrollAreaRoot";

export interface ScrollAreaRootContext {
  cornerSize: Accessor<Size>;
  setCornerSize: Setter<Size>;
  thumbSize: Accessor<Size>;
  setThumbSize: Setter<Size>;
  hasMeasuredScrollbar: Accessor<boolean>;
  setHasMeasuredScrollbar: Setter<boolean>;
  touchModality: Accessor<boolean>;
  hovering: Accessor<boolean>;
  setHovering: Setter<boolean>;
  scrollingX: Accessor<boolean>;
  scrollingY: Accessor<boolean>;
  rootElement: Accessor<HTMLElement | null>;
  setRootElement: Setter<HTMLElement | null>;
  viewportElement: Accessor<HTMLElement | null>;
  setViewportElement: Setter<HTMLElement | null>;
  scrollbarYElement: Accessor<HTMLElement | null>;
  setScrollbarYElement: Setter<HTMLElement | null>;
  scrollbarXElement: Accessor<HTMLElement | null>;
  setScrollbarXElement: Setter<HTMLElement | null>;
  thumbYElement: Accessor<HTMLElement | null>;
  setThumbYElement: Setter<HTMLElement | null>;
  thumbXElement: Accessor<HTMLElement | null>;
  setThumbXElement: Setter<HTMLElement | null>;
  cornerElement: Accessor<HTMLElement | null>;
  setCornerElement: Setter<HTMLElement | null>;
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handlePointerEnterOrMove: (event: PointerEvent) => void;
  handleTouchModalityChange: (event: PointerEvent) => void;
  handlePointerLeave: () => void;
  handleScroll: (scrollPosition: Coords) => void;
  disableViewportSnap: () => void;
  hiddenState: Accessor<HiddenState>;
  setHiddenState: Setter<HiddenState>;
  overflowEdges: Accessor<OverflowEdges>;
  setOverflowEdges: Setter<OverflowEdges>;
  viewportState: ScrollAreaRoot.State;
  overflowEdgeThreshold: {
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
  };
}

export const ScrollAreaRootContext = createContext<ScrollAreaRootContext>();

export function useScrollAreaRootContext(): ScrollAreaRootContext {
  const context = useContext(ScrollAreaRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ScrollAreaRootContext is missing. ScrollArea parts must be placed within <ScrollArea.Root>.");
  }

  return context;
}

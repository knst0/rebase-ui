import { createSignal } from "solid-js";

import { SCROLL_TIMEOUT } from "../constants";
import { orientation as orientationDataAttribute } from "../scrollbar/ScrollAreaScrollbarDataAttributes";
import { contains, getEventTarget } from "../utils/dom";
import { getOffset } from "../utils/getOffset";
import { createTimeout } from "../utils/timeout";
import type { Coords, HiddenState, OverflowEdges, ScrollAreaRoot, Size } from "./ScrollAreaRoot";
import type { ScrollAreaRootContext } from "./ScrollAreaRootContext";

export interface CreateScrollAreaRootParameters {
  overflowEdgeThreshold?: ScrollAreaRoot.OwnProps["overflowEdgeThreshold"] | undefined;
}

export function createScrollAreaRoot(parameters: CreateScrollAreaRootParameters): ScrollAreaRootContext {
  const { xStart, xEnd, yStart, yEnd } = normalizeOverflowEdgeThreshold(parameters.overflowEdgeThreshold);

  const scrollYTimeout = createTimeout();
  const scrollXTimeout = createTimeout();

  const [hovering, setHovering] = createSignal(false);
  const [scrollingX, setScrollingX] = createSignal(false);
  const [scrollingY, setScrollingY] = createSignal(false);
  const [touchModality, setTouchModality] = createSignal(false);
  const [hasMeasuredScrollbar, setHasMeasuredScrollbar] = createSignal(false);
  const [cornerSize, setCornerSize] = createSignal<Size>({ width: 0, height: 0 });
  const [thumbSize, setThumbSize] = createSignal<Size>({ width: 0, height: 0 });
  const [overflowEdges, setOverflowEdges] = createSignal<OverflowEdges>({ xStart: false, xEnd: false, yStart: false, yEnd: false });
  const [hiddenState, setHiddenState] = createSignal<HiddenState>({ x: true, y: true, corner: true });

  const [rootElement, setRootElement] = createSignal<HTMLElement | null>(null);
  const [viewportElement, setViewportElement] = createSignal<HTMLElement | null>(null);
  const [scrollbarYElement, setScrollbarYElement] = createSignal<HTMLElement | null>(null);
  const [scrollbarXElement, setScrollbarXElement] = createSignal<HTMLElement | null>(null);
  const [thumbYElement, setThumbYElement] = createSignal<HTMLElement | null>(null);
  const [thumbXElement, setThumbXElement] = createSignal<HTMLElement | null>(null);
  const [cornerElement, setCornerElement] = createSignal<HTMLElement | null>(null);

  let activePointerId: number | null = null;
  let startY = 0;
  let startX = 0;
  let startScrollTop = 0;
  let startScrollLeft = 0;
  let currentOrientation: "vertical" | "horizontal" = "vertical";
  let scrollPosition: Coords = { x: 0, y: 0 };
  let savedSnapType: string | null = null;

  function startScrolling(vertical: boolean) {
    const setScrolling = vertical ? setScrollingY : setScrollingX;
    const timeout = vertical ? scrollYTimeout : scrollXTimeout;

    setScrolling(true);
    timeout.start(SCROLL_TIMEOUT, () => {
      setScrolling(false);
    });
  }

  function handleScroll(position: Coords) {
    const offsetX = position.x - scrollPosition.x;
    const offsetY = position.y - scrollPosition.y;

    scrollPosition = position;

    if (offsetY !== 0) {
      startScrolling(true);
    }

    if (offsetX !== 0) {
      startScrolling(false);
    }
  }

  // CSS scroll snap forces every programmatic scroll to land on a snap
  // point, making thumb dragging jump between snap points. Native
  // scrollbars suppress snapping while dragging, so disable it until the
  // pointer is released; restoring the value re-snaps the viewport. The
  // save is guarded so a second pointer during an active drag can't
  // clobber the saved value with `none`.
  function disableViewportSnap() {
    const viewportEl = viewportElement();
    if (viewportEl && savedSnapType === null) {
      savedSnapType = viewportEl.style.scrollSnapType;
      viewportEl.style.scrollSnapType = "none";
    }
  }

  function resolveOrientation(event: PointerEvent): "vertical" | "horizontal" {
    const target = getEventTarget(event);
    const orientation =
      target instanceof Element
        ? (target.closest(`[${orientationDataAttribute}]`)?.getAttribute(orientationDataAttribute) as "vertical" | "horizontal" | null)
        : null;
    return orientation === "horizontal" ? "horizontal" : "vertical";
  }

  function capturePointer(thumb: HTMLElement | null, pointerId: number) {
    if (thumb == null || typeof thumb.setPointerCapture !== "function") {
      return;
    }

    try {
      thumb.setPointerCapture(pointerId);
    } catch {
      /* ignore environments without pointer capture */
    }
  }

  function releasePointerCapture(thumb: HTMLElement | null, pointerId: number) {
    if (thumb == null || typeof thumb.releasePointerCapture !== "function") {
      return;
    }

    // `pointercancel` releases capture implicitly, so guard against releasing a
    // capture we no longer hold (which would throw).
    try {
      if (typeof thumb.hasPointerCapture === "function" && thumb.hasPointerCapture(pointerId)) {
        thumb.releasePointerCapture(pointerId);
      }
    } catch {
      /* ignore environments without pointer capture */
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    const activeThumb = currentOrientation === "vertical" ? thumbYElement() : thumbXElement();
    if (activePointerId !== null) {
      // A live drag holds capture for the active pointer — ignore other pointers.
      // No capture means the release went missing entirely (silent capture drop
      // with an id that never reappears, e.g. a lost touch contact), so let the
      // new pointer take over the latch instead of leaving dragging dead.
      if (activeThumb != null && hasCapture(activeThumb, activePointerId)) {
        return;
      }
    }

    activePointerId = event.pointerId;
    startY = event.clientY;
    startX = event.clientX;
    currentOrientation = resolveOrientation(event);

    const viewportEl = viewportElement();
    if (viewportEl) {
      startScrollTop = viewportEl.scrollTop;
      startScrollLeft = viewportEl.scrollLeft;
      disableViewportSnap();
    }

    const thumb = currentOrientation === "vertical" ? thumbYElement() : thumbXElement();
    capturePointer(thumb, event.pointerId);
  }

  function handlePointerUp(event: PointerEvent) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    // Clear the drag's scrolling state immediately rather than waiting for the
    // `SCROLL_TIMEOUT` timer armed by the last drag move, so every release path
    // (real, `pointercancel`, or the missed-release fallback) behaves the same.
    (currentOrientation === "vertical" ? setScrollingY : setScrollingX)(false);

    if (savedSnapType !== null) {
      const viewportEl = viewportElement();
      if (viewportEl) {
        viewportEl.style.scrollSnapType = savedSnapType;
      }
      savedSnapType = null;
    }

    const thumb = currentOrientation === "vertical" ? thumbYElement() : thumbXElement();
    releasePointerCapture(thumb, event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // The release can go missing entirely (e.g. the browser drops pointer
    // capture while the scrollbar is hidden mid-drag), leaving the drag
    // latched so a buttonless hover over the thumb scrolls the viewport.
    // Treat a move without the primary button held (`buttons` bit 1 unset)
    // as the missed release.
    if (event.buttons % 2 === 0) {
      handlePointerUp(event);
      return;
    }

    const viewportEl = viewportElement();
    if (!viewportEl) {
      return;
    }

    const vertical = currentOrientation === "vertical";
    const thumbEl = vertical ? thumbYElement() : thumbXElement();
    const scrollbarEl = vertical ? scrollbarYElement() : scrollbarXElement();
    if (!thumbEl || !scrollbarEl) {
      return;
    }

    const axis = vertical ? "y" : "x";
    const scrollbarOffset = getOffset(scrollbarEl, "padding", axis);
    const thumbOffset = getOffset(thumbEl, "margin", axis);
    const thumbSizePx = vertical ? thumbEl.offsetHeight : thumbEl.offsetWidth;
    const trackSize = vertical ? scrollbarEl.offsetHeight : scrollbarEl.offsetWidth;
    const maxThumbOffset = trackSize - thumbSizePx - scrollbarOffset - thumbOffset;
    // A short or heavily padded track can drive `maxThumbOffset` to zero or
    // negative once the thumb hits its `MIN_THUMB_SIZE` floor. Dividing by it
    // would yield a non-finite (`Infinity`/`NaN`) or inverted scroll position.
    const delta = vertical ? event.clientY - startY : event.clientX - startX;
    const scrollRatio = maxThumbOffset <= 0 ? 0 : delta / maxThumbOffset;

    const scrollableSize = vertical ? viewportEl.scrollHeight : viewportEl.scrollWidth;
    const viewportSize = vertical ? viewportEl.clientHeight : viewportEl.clientWidth;
    const startScroll = vertical ? startScrollTop : startScrollLeft;
    const nextScroll = startScroll + scrollRatio * (scrollableSize - viewportSize);

    if (vertical) {
      viewportEl.scrollTop = nextScroll;
    } else {
      viewportEl.scrollLeft = nextScroll;
    }
    event.preventDefault();

    startScrolling(vertical);
  }

  function handleTouchModalityChange(event: PointerEvent) {
    setTouchModality(event.pointerType === "touch");
  }

  function handlePointerEnterOrMove(event: PointerEvent) {
    handleTouchModalityChange(event);

    if (event.pointerType !== "touch") {
      const isTargetRootChild = contains(rootElement(), getEventTarget(event) as Element | null);
      setHovering(isTargetRootChild);
    }
  }

  function handlePointerLeave() {
    setHovering(false);
  }

  const state: ScrollAreaRoot.State = {
    scrolling: () => scrollingX() || scrollingY(),
    hasOverflowX: () => !hiddenState().x,
    hasOverflowY: () => !hiddenState().y,
    overflowXStart: () => overflowEdges().xStart,
    overflowXEnd: () => overflowEdges().xEnd,
    overflowYStart: () => overflowEdges().yStart,
    overflowYEnd: () => overflowEdges().yEnd,
    cornerHidden: () => hiddenState().corner,
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerEnterOrMove,
    handleTouchModalityChange,
    handlePointerLeave,
    handleScroll,
    disableViewportSnap,
    cornerSize,
    setCornerSize,
    thumbSize,
    setThumbSize,
    hasMeasuredScrollbar,
    setHasMeasuredScrollbar,
    touchModality,
    hovering,
    setHovering,
    scrollingX,
    scrollingY,
    rootElement,
    setRootElement,
    viewportElement,
    setViewportElement,
    scrollbarYElement,
    setScrollbarYElement,
    scrollbarXElement,
    setScrollbarXElement,
    thumbYElement,
    setThumbYElement,
    thumbXElement,
    setThumbXElement,
    cornerElement,
    setCornerElement,
    hiddenState,
    setHiddenState,
    overflowEdges,
    setOverflowEdges,
    viewportState: state,
    overflowEdgeThreshold: { xStart, xEnd, yStart, yEnd },
  };
}

function hasCapture(thumb: HTMLElement, pointerId: number): boolean {
  if (typeof thumb.hasPointerCapture !== "function") {
    return false;
  }

  try {
    return thumb.hasPointerCapture(pointerId);
  } catch {
    return false;
  }
}

export function normalizeOverflowEdgeThreshold(threshold: ScrollAreaRoot.OwnProps["overflowEdgeThreshold"]): {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
} {
  const thresholds = typeof threshold === "number" ? { xStart: threshold, xEnd: threshold, yStart: threshold, yEnd: threshold } : threshold;

  return {
    xStart: Math.max(0, thresholds?.xStart || 0),
    xEnd: Math.max(0, thresholds?.xEnd || 0),
    yStart: Math.max(0, thresholds?.yStart || 0),
    yEnd: Math.max(0, thresholds?.yEnd || 0),
  };
}

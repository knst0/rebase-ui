import { store, untrack } from "reze-js";

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

  const state = store({
    hovering: false,
    scrollingX: false,
    scrollingY: false,
    touchModality: false,
    hasMeasuredScrollbar: false,
    cornerSize: { width: 0, height: 0 } as Size,
    thumbSize: { width: 0, height: 0 } as Size,
    overflowEdges: { xStart: false, xEnd: false, yStart: false, yEnd: false } as OverflowEdges,
    hiddenState: { x: true, y: true, corner: true } as HiddenState,
    rootElement: null as HTMLElement | null,
    viewportElement: null as HTMLElement | null,
    scrollbarYElement: null as HTMLElement | null,
    scrollbarXElement: null as HTMLElement | null,
    thumbYElement: null as HTMLElement | null,
    thumbXElement: null as HTMLElement | null,
    cornerElement: null as HTMLElement | null,
  });

  let activePointerId: number | null = null;
  let startY = 0;
  let startX = 0;
  let startScrollTop = 0;
  let startScrollLeft = 0;
  let currentOrientation: "vertical" | "horizontal" = "vertical";
  let scrollPosition: Coords = { x: 0, y: 0 };
  let savedSnapType: string | null = null;

  function startScrolling(vertical: boolean) {
    const timeout = vertical ? scrollYTimeout : scrollXTimeout;

    if (vertical) {
      state.scrollingY = true;
    } else {
      state.scrollingX = true;
    }
    timeout.start(SCROLL_TIMEOUT, () => {
      if (vertical) {
        state.scrollingY = false;
      } else {
        state.scrollingX = false;
      }
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
    const viewportEl = state.viewportElement;
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

    const activeThumb = currentOrientation === "vertical" ? state.thumbYElement : state.thumbXElement;
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

    const viewportEl = state.viewportElement;
    if (viewportEl) {
      startScrollTop = viewportEl.scrollTop;
      startScrollLeft = viewportEl.scrollLeft;
      disableViewportSnap();
    }

    const thumb = currentOrientation === "vertical" ? state.thumbYElement : state.thumbXElement;
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
    if (currentOrientation === "vertical") {
      state.scrollingY = false;
    } else {
      state.scrollingX = false;
    }

    if (savedSnapType !== null) {
      const viewportEl = state.viewportElement;
      if (viewportEl) {
        viewportEl.style.scrollSnapType = savedSnapType;
      }
      savedSnapType = null;
    }

    const thumb = currentOrientation === "vertical" ? state.thumbYElement : state.thumbXElement;
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

    const viewportEl = state.viewportElement;
    if (!viewportEl) {
      return;
    }

    const vertical = currentOrientation === "vertical";
    const thumbEl = vertical ? state.thumbYElement : state.thumbXElement;
    const scrollbarEl = vertical ? state.scrollbarYElement : state.scrollbarXElement;
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
    state.touchModality = event.pointerType === "touch";
  }

  function handlePointerEnterOrMove(event: PointerEvent) {
    handleTouchModalityChange(event);

    if (event.pointerType !== "touch") {
      const isTargetRootChild = contains(state.rootElement, getEventTarget(event) as Element | null);
      state.hovering = isTargetRootChild;
    }
  }

  function handlePointerLeave() {
    state.hovering = false;
  }

  function cornerSize(): Size {
    return state.cornerSize;
  }

  // Object setters assign per-field and only on change (like the Solid layer's
  // `pickState` bail-out), so scroll-frame updates don't notify unrelated readers.
  // The compare reads run untracked so a call from a reactive scope does not
  // subscribe the caller to the fields it writes.
  function setCornerSize(next: Size): void {
    untrack(() => {
      if (state.cornerSize.width !== next.width) {
        state.cornerSize.width = next.width;
      }
      if (state.cornerSize.height !== next.height) {
        state.cornerSize.height = next.height;
      }
    });
  }

  function thumbSize(): Size {
    return state.thumbSize;
  }

  function setThumbSize(next: Size): void {
    untrack(() => {
      if (state.thumbSize.width !== next.width) {
        state.thumbSize.width = next.width;
      }
      if (state.thumbSize.height !== next.height) {
        state.thumbSize.height = next.height;
      }
    });
  }

  function hasMeasuredScrollbar(): boolean {
    return state.hasMeasuredScrollbar;
  }

  function setHasMeasuredScrollbar(next: boolean): void {
    state.hasMeasuredScrollbar = next;
  }

  function touchModality(): boolean {
    return state.touchModality;
  }

  function hovering(): boolean {
    return state.hovering;
  }

  function setHovering(next: boolean): void {
    state.hovering = next;
  }

  function scrollingX(): boolean {
    return state.scrollingX;
  }

  function scrollingY(): boolean {
    return state.scrollingY;
  }

  function rootElement(): HTMLElement | null {
    return state.rootElement;
  }

  function setRootElement(element: HTMLElement | null): void {
    state.rootElement = element;
  }

  function viewportElement(): HTMLElement | null {
    return state.viewportElement;
  }

  function setViewportElement(element: HTMLElement | null): void {
    state.viewportElement = element;
  }

  function scrollbarYElement(): HTMLElement | null {
    return state.scrollbarYElement;
  }

  function setScrollbarYElement(element: HTMLElement | null): void {
    state.scrollbarYElement = element;
  }

  function scrollbarXElement(): HTMLElement | null {
    return state.scrollbarXElement;
  }

  function setScrollbarXElement(element: HTMLElement | null): void {
    state.scrollbarXElement = element;
  }

  function thumbYElement(): HTMLElement | null {
    return state.thumbYElement;
  }

  function setThumbYElement(element: HTMLElement | null): void {
    state.thumbYElement = element;
  }

  function thumbXElement(): HTMLElement | null {
    return state.thumbXElement;
  }

  function setThumbXElement(element: HTMLElement | null): void {
    state.thumbXElement = element;
  }

  function cornerElement(): HTMLElement | null {
    return state.cornerElement;
  }

  function setCornerElement(element: HTMLElement | null): void {
    state.cornerElement = element;
  }

  function hiddenState(): HiddenState {
    return state.hiddenState;
  }

  function setHiddenState(next: HiddenState): void {
    untrack(() => {
      if (state.hiddenState.x !== next.x) {
        state.hiddenState.x = next.x;
      }
      if (state.hiddenState.y !== next.y) {
        state.hiddenState.y = next.y;
      }
      if (state.hiddenState.corner !== next.corner) {
        state.hiddenState.corner = next.corner;
      }
    });
  }

  function overflowEdges(): OverflowEdges {
    return state.overflowEdges;
  }

  function setOverflowEdges(next: OverflowEdges): void {
    untrack(() => {
      if (state.overflowEdges.xStart !== next.xStart) {
        state.overflowEdges.xStart = next.xStart;
      }
      if (state.overflowEdges.xEnd !== next.xEnd) {
        state.overflowEdges.xEnd = next.xEnd;
      }
      if (state.overflowEdges.yStart !== next.yStart) {
        state.overflowEdges.yStart = next.yStart;
      }
      if (state.overflowEdges.yEnd !== next.yEnd) {
        state.overflowEdges.yEnd = next.yEnd;
      }
    });
  }

  function rootStateSnapshot(): ScrollAreaRoot.State {
    return {
      scrolling: state.scrollingX || state.scrollingY,
      hasOverflowX: !state.hiddenState.x,
      hasOverflowY: !state.hiddenState.y,
      overflowXStart: state.overflowEdges.xStart,
      overflowXEnd: state.overflowEdges.xEnd,
      overflowYStart: state.overflowEdges.yStart,
      overflowYEnd: state.overflowEdges.yEnd,
      cornerHidden: state.hiddenState.corner,
    };
  }

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
    rootStateSnapshot,
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

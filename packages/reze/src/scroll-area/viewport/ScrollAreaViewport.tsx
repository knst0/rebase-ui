import { clamp } from "@rebase-ui/core/clamp";
import { normalizeScrollOffset } from "@rebase-ui/core/scrollEdges";
import { dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { getFiniteAnimations } from "../../internals/utils/getFiniteAnimations";
import type { RebaseUIEvent } from "../../types";
import { MIN_THUMB_SIZE } from "../constants";
import type { HiddenState, ScrollAreaRootState } from "../root/ScrollAreaRoot";
import { useScrollAreaRootContext } from "../root/ScrollAreaRootContext";
import { scrollAreaThumbHeight, scrollAreaThumbWidth } from "../scrollbar/ScrollAreaScrollbarCssVars";
import { DISABLE_SCROLLBAR_CLASS_NAME } from "../utils/disableScrollbar";
import { evaluateTag } from "../utils/evaluateTag";
import { getOffset } from "../utils/getOffset";
import { createTimeout } from "../utils/timeout";
import { ScrollAreaViewportContext } from "./ScrollAreaViewportContext";
import {
  scrollAreaOverflowXEnd,
  scrollAreaOverflowXStart,
  scrollAreaOverflowYEnd,
  scrollAreaOverflowYStart,
} from "./ScrollAreaViewportCssVars";

const OVERFLOW_EDGE_VARS = [scrollAreaOverflowXStart, scrollAreaOverflowXEnd, scrollAreaOverflowYStart, scrollAreaOverflowYEnd];

// Module-level flag to ensure we only register the CSS properties once,
// regardless of how many Scroll Area components are mounted.
let scrollAreaOverflowVarsRegistered = false;

/**
 * Removes inheritance of the scroll area overflow CSS variables, which
 * improves rendering performance in complex scroll areas with deep subtrees.
 * Instead, each child must manually opt-in to using these properties by
 * specifying `inherit`.
 * See https://motion.dev/blog/web-animation-performance-tier-list
 * under the "Improving CSS variable performance" section.
 */
function removeCSSVariableInheritance() {
  if (
    scrollAreaOverflowVarsRegistered ||
    // When `inherits: false`, specifying `inherit` on child elements doesn't work
    // in Safari. To let CSS features work correctly, this optimization must be skipped.
    isWebKitEngine()
  ) {
    return;
  }

  if (typeof CSS !== "undefined" && "registerProperty" in CSS) {
    OVERFLOW_EDGE_VARS.forEach((name) => {
      try {
        CSS.registerProperty({
          name,
          syntax: "<length>",
          inherits: false,
          initialValue: "0px",
        });
      } catch {
        /* ignore already-registered */
      }
    });
  }

  scrollAreaOverflowVarsRegistered = true;
}

function isWebKitEngine(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent;
  return /AppleWebKit/i.test(userAgent) && !/Chrome|Chromium/i.test(userAgent);
}

function getViewportDirection(viewport: HTMLElement | null): "ltr" | "rtl" {
  if (viewport == null || typeof getComputedStyle !== "function") {
    return "ltr";
  }

  return getComputedStyle(viewport).direction === "rtl" ? "rtl" : "ltr";
}

/**
 * The actual scrollable container of the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Scroll Area](https://rebase-ui.knst.dev/components/scroll-area)
 */
export function ScrollAreaViewport<T extends JSX.ElementType = "div">(props: ScrollAreaViewport.Props<T>) {
  const root = useScrollAreaRootContext();

  let programmaticScroll = true;
  const lastMeasuredViewportMetrics: [number, number, number, number] = [NaN, NaN, NaN, NaN];

  const scrollEndTimeout = createTimeout();
  const waitForAnimationsTimeout = createTimeout();

  let resizeObserver: ResizeObserver | undefined;

  function computeThumbPosition() {
    const viewportEl = root.viewportElement();
    const scrollbarYEl = root.scrollbarYElement();
    const scrollbarXEl = root.scrollbarXElement();
    const thumbYEl = root.thumbYElement();
    const thumbXEl = root.thumbXElement();
    const cornerEl = root.cornerElement();

    if (!viewportEl) {
      return;
    }

    const direction = getViewportDirection(viewportEl);

    const scrollableContentHeight = viewportEl.scrollHeight;
    const scrollableContentWidth = viewportEl.scrollWidth;
    const viewportHeight = viewportEl.clientHeight;
    const viewportWidth = viewportEl.clientWidth;
    const scrollTop = viewportEl.scrollTop;
    const scrollLeft = viewportEl.scrollLeft;
    const isFirstMeasurement = Number.isNaN(lastMeasuredViewportMetrics[0]);

    lastMeasuredViewportMetrics[0] = viewportHeight;
    lastMeasuredViewportMetrics[1] = scrollableContentHeight;
    lastMeasuredViewportMetrics[2] = viewportWidth;
    lastMeasuredViewportMetrics[3] = scrollableContentWidth;

    if (isFirstMeasurement) {
      root.setHasMeasuredScrollbar(true);
    }

    if (scrollableContentHeight === 0 || scrollableContentWidth === 0) {
      return;
    }

    const nextHiddenState = getHiddenState(viewportEl);
    const scrollbarYHidden = nextHiddenState.y;
    const scrollbarXHidden = nextHiddenState.x;
    const ratioX = viewportWidth / scrollableContentWidth;
    const ratioY = viewportHeight / scrollableContentHeight;
    const maxScrollLeft = Math.max(0, scrollableContentWidth - viewportWidth);
    const maxScrollTop = Math.max(0, scrollableContentHeight - viewportHeight);

    let scrollLeftFromStart = 0;
    let scrollLeftFromEnd = 0;
    if (!scrollbarXHidden) {
      // `normalizeScrollOffset` clamps internally.
      scrollLeftFromStart = normalizeScrollOffset(direction === "rtl" ? -scrollLeft : scrollLeft, maxScrollLeft);
      scrollLeftFromEnd = maxScrollLeft - scrollLeftFromStart;
    }

    const scrollTopFromStart = scrollbarYHidden ? 0 : normalizeScrollOffset(scrollTop, maxScrollTop);
    const scrollTopFromEnd = scrollbarYHidden ? 0 : maxScrollTop - scrollTopFromStart;
    const nextWidth = scrollbarXHidden ? 0 : viewportWidth;
    const nextHeight = scrollbarYHidden ? 0 : viewportHeight;

    let nextCornerWidth = 0;
    let nextCornerHeight = 0;
    if (!scrollbarXHidden && !scrollbarYHidden) {
      nextCornerWidth = scrollbarYEl?.offsetWidth || 0;
      nextCornerHeight = scrollbarXEl?.offsetHeight || 0;
    }

    // Only subtract corner size from scrollbar dimensions if the corner hasn't been sized yet.
    // Once sized, the layout will already account for it.
    const corner = root.cornerSize();
    const cornerNotYetSized = corner.width === 0 && corner.height === 0;
    const cornerWidthOffset = cornerNotYetSized ? nextCornerWidth : 0;
    const cornerHeightOffset = cornerNotYetSized ? nextCornerHeight : 0;

    const scrollbarXOffset = getOffset(scrollbarXEl, "padding", "x");
    const scrollbarYOffset = getOffset(scrollbarYEl, "padding", "y");
    const thumbXOffset = getOffset(thumbXEl, "margin", "x");
    const thumbYOffset = getOffset(thumbYEl, "margin", "y");

    const idealNextWidth = nextWidth - scrollbarXOffset - thumbXOffset;
    const idealNextHeight = nextHeight - scrollbarYOffset - thumbYOffset;

    const maxNextWidth = scrollbarXEl ? Math.min(scrollbarXEl.offsetWidth - cornerWidthOffset, idealNextWidth) : idealNextWidth;
    const maxNextHeight = scrollbarYEl ? Math.min(scrollbarYEl.offsetHeight - cornerHeightOffset, idealNextHeight) : idealNextHeight;

    const clampedNextWidth = Math.max(MIN_THUMB_SIZE, maxNextWidth * ratioX);
    const clampedNextHeight = Math.max(MIN_THUMB_SIZE, maxNextHeight * ratioY);

    root.setThumbSize({ width: clampedNextWidth, height: clampedNextHeight });

    // Handle Y (vertical) scroll
    if (scrollbarYEl && thumbYEl) {
      const maxThumbOffsetY = scrollbarYEl.offsetHeight - clampedNextHeight - scrollbarYOffset - thumbYOffset;

      const thumbOffsetY = applyOverscrollThumb(
        thumbYEl,
        scrollAreaThumbHeight,
        scrollTop,
        maxScrollTop,
        scrollableContentHeight,
        clampedNextHeight,
        maxThumbOffsetY,
      );
      thumbYEl.style.transform = `translate3d(0,${thumbOffsetY}px,0)`;
    }

    // Handle X (horizontal) scroll
    if (scrollbarXEl && thumbXEl) {
      const maxThumbOffsetX = scrollbarXEl.offsetWidth - clampedNextWidth - scrollbarXOffset - thumbXOffset;
      // RTL scrolls from 0 down to `-maxScrollLeft`; measure from the inline start edge so the
      // overscroll math is direction-agnostic, then flip the resulting offset back below.
      const scrollFromStart = direction === "rtl" ? -scrollLeft : scrollLeft;

      const offsetX = applyOverscrollThumb(
        thumbXEl,
        scrollAreaThumbWidth,
        scrollFromStart,
        maxScrollLeft,
        scrollableContentWidth,
        clampedNextWidth,
        maxThumbOffsetX,
      );
      thumbXEl.style.transform = `translate3d(${direction === "rtl" ? -offsetX : offsetX}px,0,0)`;
    }

    const overflowMetricsPx = [scrollLeftFromStart, scrollLeftFromEnd, scrollTopFromStart, scrollTopFromEnd];

    OVERFLOW_EDGE_VARS.forEach((cssVar, index) => {
      viewportEl.style.setProperty(cssVar, `${overflowMetricsPx[index]}px`);
    });

    if (cornerEl) {
      // Bail when the size is unchanged (like `setThumbSize` above); otherwise a
      // fresh object literal on every scroll frame rebuilds the root context and
      // re-renders every scroll-area part.
      // `nextCornerWidth`/`nextCornerHeight` stay 0 when either scrollbar is hidden.
      root.setCornerSize({ width: nextCornerWidth, height: nextCornerHeight });
    }

    root.setHiddenState(nextHiddenState);

    const threshold = root.overflowEdgeThreshold;
    const nextOverflowEdges = {
      xStart: !scrollbarXHidden && scrollLeftFromStart > threshold.xStart,
      xEnd: !scrollbarXHidden && scrollLeftFromEnd > threshold.xEnd,
      yStart: !scrollbarYHidden && scrollTopFromStart > threshold.yStart,
      yEnd: !scrollbarYHidden && scrollTopFromEnd > threshold.yEnd,
    };

    root.setOverflowEdges(nextOverflowEdges);
  }

  function setViewportRef(element: HTMLElement | null) {
    root.setViewportElement(element);

    resizeObserver?.disconnect();
    resizeObserver = undefined;

    if (!element) {
      return;
    }

    removeCSSVariableInheritance();

    // Wait for scrollbar and thumb refs after hidden-state toggles, refresh math on direction
    // flips, and re-evaluate overflow edges when the threshold changes.
    queueMicrotask(computeThumbPosition);

    // `onMouseEnter` doesn't fire upon load, so we need to check if the viewport is already
    // being hovered.
    if (element.matches(":hover")) {
      root.setHovering(true);
    }

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const viewport = element;
    let hasInitialized = false;
    resizeObserver = new ResizeObserver(() => {
      // Avoid duplicate mount-time recompute when observer data matches what the mount
      // scheduling pass already measured. If dimensions changed before the first observer
      // delivery, keep the recompute so overflow transitions stay in sync.
      if (!hasInitialized) {
        hasInitialized = true;
        if (
          lastMeasuredViewportMetrics[0] === viewport.clientHeight &&
          lastMeasuredViewportMetrics[1] === viewport.scrollHeight &&
          lastMeasuredViewportMetrics[2] === viewport.clientWidth &&
          lastMeasuredViewportMetrics[3] === viewport.scrollWidth
        ) {
          return;
        }
      }

      computeThumbPosition();
    });

    resizeObserver.observe(viewport);

    // Wait for subtree animations to finish, then recompute thumb geometry that
    // may have been affected by transform-based animations.
    waitForAnimationsTimeout.start(0, () => {
      if (typeof viewport.getAnimations !== "function") {
        return;
      }

      const animations = getFiniteAnimations(viewport, { subtree: true });
      if (animations.length === 0) {
        return;
      }

      // `allSettled` never rejects, but `computeThumbPosition` can still run against a
      // torn-down tree once the animations resolve. Swallow instead of leaking an unhandled
      // rejection; `void` alone would only silence the floating-promise lint.
      // Discard fulfilled Animation values so unfinished animations cannot retain their targets.
      Promise.allSettled(animations.map((animation) => animation.finished.then(noop)))
        .then(computeThumbPosition)
        .catch(() => {});
    });
  }

  onCleanup(() => {
    resizeObserver?.disconnect();
  });

  effect(() => {
    // Re-run the measurement scheduling pass when the hidden state toggles so the
    // newly mounted scrollbar and thumb refs are measured. `setHiddenState` bails
    // out on shallow-equal values, so this converges instead of looping.
    void root.hiddenState().x;
    void root.hiddenState().y;
    queueMicrotask(computeThumbPosition);
  });

  function handleUserInteraction() {
    programmaticScroll = false;
  }

  function handleScrollEvent() {
    const viewportEl = root.viewportElement();
    if (!viewportEl) {
      return;
    }

    computeThumbPosition();

    // WebKit consumes a touch that catches an in-flight momentum scroll or
    // rubber-band bounce without dispatching any DOM events for the whole
    // gesture (not even `touchstart`), so scrolls cannot be attributed to
    // the user through events. Treat every scroll in touch modality as
    // user-driven instead.
    if (root.touchModality() || !programmaticScroll) {
      root.handleScroll({
        x: viewportEl.scrollLeft,
        y: viewportEl.scrollTop,
      });
    }

    // Debounce the restoration of the programmatic flag so that it only
    // flips back to `true` once scrolling has come to a rest. This ensures
    // that momentum scrolling (where no further user-interaction events fire)
    // is still treated as user-driven.
    // 100 ms without scroll events ≈ scroll end
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event
    scrollEndTimeout.start(100, () => {
      programmaticScroll = true;
    });
  }

  const contextValue: ScrollAreaViewportContext = {
    computeThumbPosition,
  };

  // The provider wraps the element (rather than living inside the tag): the
  // content needs both the root and the viewport context, and context does not
  // flow through dynamicElement — children read inside the tag would only see
  // the viewport provider. Reading them in ScrollAreaViewportElement below
  // keeps both providers visible. Deliberately not hoisted: `props.children`
  // must be read in the element body, not here.
  return (
    <ScrollAreaViewportContext value={contextValue}>
      <ScrollAreaViewportElement
        elementProps={props}
        setViewportRef={setViewportRef}
        onScroll={handleScrollEvent}
        onUserInteraction={handleUserInteraction}
      >
        {props.children}
      </ScrollAreaViewportElement>
    </ScrollAreaViewportContext>
  );
}

/**
 * Renders the viewport element inside the viewport context. Split from `ScrollAreaViewport`
 * so the content is created under both the root and the viewport providers: reading the
 * children getter in `ScrollAreaViewport` itself would instantiate them before the
 * viewport provider exists, and reading it inside the tag would cut off the root
 * provider (context does not flow through dynamicElement).
 */
function ScrollAreaViewportElement<T extends JSX.ElementType>(props: ScrollAreaViewportElementProps<T>) {
  const outer = props.elementProps;
  const rest = omitProps(outer, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const root = useScrollAreaRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => outer.as ?? "div");

  const tag = (
    <Tag
      {...(rest as Record<string, unknown>)}
      tabindex={
        // https://accessibilityinsights.io/info-examples/web/scrollable-region-focusable/
        // Keep non-scrollable viewports out of tab order.
        root.hiddenState().x && root.hiddenState().y ? -1 : 0
      }
      onScroll={outer.onScroll ?? props.onScroll}
      onWheel={outer.onWheel ?? props.onUserInteraction}
      onPointerMove={outer.onPointerMove ?? props.onUserInteraction}
      onPointerEnter={outer.onPointerEnter ?? props.onUserInteraction}
      onKeyDown={outer.onKeyDown ?? props.onUserInteraction}
      data-scrolling={root.scrollingX() || root.scrollingY() ? "" : undefined}
      data-has-overflow-x={root.hiddenState().x ? undefined : ""}
      data-has-overflow-y={root.hiddenState().y ? undefined : ""}
      data-overflow-x-start={root.overflowEdges().xStart ? "" : undefined}
      data-overflow-x-end={root.overflowEdges().xEnd ? "" : undefined}
      data-overflow-y-start={root.overflowEdges().yStart ? "" : undefined}
      data-overflow-y-end={root.overflowEdges().yEnd ? "" : undefined}
      class={[DISABLE_SCROLLBAR_CLASS_NAME, resolveClassValue(outer.class, root.rootStateSnapshot())]}
      style={mergeStyleValue({ overflow: "scroll" }, resolveStyleValue(outer.style, root.rootStateSnapshot()))}
      ref={mergeRefs(props.setViewportRef, outer.ref as ((element: HTMLElement | null) => void) | undefined)}
    >
      {resolveViewportChildren(children, root.rootStateSnapshot)}
    </Tag>
  );

  // The tag is evaluated eagerly so the tree holds a stable node: re-evaluating it
  // (e.g. when the scrollbar mounts) would recreate the viewport, resetting scroll.
  return evaluateTag(tag);
}

/**
 * Resolves the viewport children. Render-prop children are invoked inside a thunk (bound
 * by the renderer) and re-invoked with a fresh state snapshot whenever the scroll area
 * state changes. The thunk re-enters this owner so the rendered content keeps both the
 * root and the viewport context (the renderer would otherwise evaluate it detached).
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
function resolveViewportChildren(
  children: ChildrenValue<ScrollAreaViewportState> | undefined,
  snapshot: () => ScrollAreaViewportState,
): JSX.Element {
  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: ScrollAreaViewportState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the scroll area contexts (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const state = snapshot();

      return runWithOwner(owner, () => render(state));
    };
  }

  return children as JSX.Element;
}

interface ScrollAreaViewportElementProps<T extends JSX.ElementType> {
  elementProps: ScrollAreaViewport.Props<T>;
  setViewportRef: (element: HTMLElement | null) => void;
  onScroll: () => void;
  onUserInteraction: () => void;
  children?: ChildrenValue<ScrollAreaViewportState> | undefined;
}

export interface ScrollAreaViewportState extends ScrollAreaRootState {}

export interface ScrollAreaViewportOwnProps {
  /**
   * Handler for the viewport's `keydown` event. Replaces the built-in
   * user-interaction tracking.
   */
  onKeyDown?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
}

export type ScrollAreaViewportProps<T extends JSX.ElementType = "div"> = ScrollAreaViewportOwnProps &
  RebaseUIComponentProps<T, ScrollAreaViewportState>;

export namespace ScrollAreaViewport {
  export type State = ScrollAreaViewportState;
  export type Props<T extends JSX.ElementType = "div"> = ScrollAreaViewportProps<T>;
  export type OwnProps = ScrollAreaViewportOwnProps;
}

function getHiddenState(viewport: HTMLElement): HiddenState {
  const y = viewport.clientHeight >= viewport.scrollHeight;
  const x = viewport.clientWidth >= viewport.scrollWidth;

  return {
    y,
    x,
    corner: y || x,
  };
}

/**
 * Sizes the thumb and returns its axis offset. On overscroll (Safari rubber-band only) it shrinks
 * against the pinned edge, damped by `content / (content + overscroll)` to match native feedback;
 * the size flows through the thumb-size variable so the resting `var(...)` still applies.
 */
function applyOverscrollThumb(
  thumbEl: HTMLElement,
  sizeVar: string,
  scrollFromStart: number,
  maxScroll: number,
  content: number,
  size: number,
  maxThumbOffset: number,
): number {
  const clamped = clamp(scrollFromStart, 0, maxScroll);
  const overscroll = scrollFromStart - clamped;
  const nextSize = Math.max(MIN_THUMB_SIZE, (size * content) / (content + Math.abs(overscroll)));

  // Passing an empty string removes the override, restoring the resting `var(...)` size.
  thumbEl.style.setProperty(sizeVar, overscroll ? `${nextSize}px` : "");

  // Slide proportionally; at the end edge push down by the shrink so the thumb stays pinned to
  // it, while a start overscroll pins to offset 0.
  const offset = maxScroll ? (clamped / maxScroll) * maxThumbOffset : 0;
  return offset + (overscroll > 0 ? size - nextSize : 0);
}

const noop = () => {};

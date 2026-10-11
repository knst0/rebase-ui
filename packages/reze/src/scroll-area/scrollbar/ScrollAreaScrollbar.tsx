import { dynamicElement, getOwner, omitProps, onCleanup, runWithOwner, untrack, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, Orientation, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import type { ScrollAreaRootState } from "../root/ScrollAreaRoot";
import { useScrollAreaRootContext } from "../root/ScrollAreaRootContext";
import { scrollAreaCornerHeight, scrollAreaCornerWidth } from "../root/ScrollAreaRootCssVars";
import { addEventListener } from "../utils/addEventListener";
import { evaluateTag } from "../utils/evaluateTag";
import { getOffset } from "../utils/getOffset";
import { ScrollAreaScrollbarContext } from "./ScrollAreaScrollbarContext";
import { scrollAreaThumbHeight, scrollAreaThumbWidth } from "./ScrollAreaScrollbarCssVars";

/**
 * A vertical or horizontal scrollbar for the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Scroll Area](https://rebase-ui.knst.dev/components/scroll-area)
 */
export function ScrollAreaScrollbar<T extends JSX.ElementType = "div">(props: ScrollAreaScrollbar.Props<T>) {
  const root = useScrollAreaRootContext();

  // Structural: the axis a scrollbar controls never changes without remounting.
  const orientation = untrack(() => props.orientation) ?? "vertical";
  const vertical = orientation === "vertical";

  function getViewportDirection(): "ltr" | "rtl" {
    const viewportEl = root.viewportElement();
    if (viewportEl == null || typeof getComputedStyle !== "function") {
      return "ltr";
    }

    return getComputedStyle(viewportEl).direction === "rtl" ? "rtl" : "ltr";
  }

  function handleWheel(event: WheelEvent) {
    const viewportEl = root.viewportElement();
    if (!viewportEl || event.ctrlKey) {
      return;
    }

    const horizontal = !vertical;
    const scrollProperty = horizontal ? "scrollLeft" : "scrollTop";
    const delta = horizontal ? event.deltaX : event.deltaY;
    if (delta === 0) {
      return;
    }

    const direction = getViewportDirection();
    const maxScroll = horizontal ? viewportEl.scrollWidth - viewportEl.clientWidth : viewportEl.scrollHeight - viewportEl.clientHeight;
    // RTL horizontal scrolling uses a negative `scrollLeft` range, from 0 to `-maxScroll`.
    const minScroll = horizontal && direction === "rtl" ? -maxScroll : 0;
    const maxScrollValue = horizontal && direction === "rtl" ? 0 : maxScroll;
    const scrollValue = viewportEl[scrollProperty];

    // At an edge (or with no overflow), let the wheel event chain to the
    // parent/page instead of swallowing it via `preventDefault`.
    if ((scrollValue <= minScroll && delta < 0) || (scrollValue >= maxScrollValue && delta > 0)) {
      return;
    }

    event.preventDefault();

    viewportEl[scrollProperty] = Math.min(maxScrollValue, Math.max(minScroll, scrollValue + delta));

    root.handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });
  }

  let removeWheelListener: (() => void) | undefined;

  function setScrollbarRef(element: HTMLElement | null) {
    if (vertical) {
      root.setScrollbarYElement(element);
    } else {
      root.setScrollbarXElement(element);
    }

    removeWheelListener?.();
    removeWheelListener = undefined;

    if (element) {
      removeWheelListener = addEventListener(element, "wheel", handleWheel as EventListener, { passive: false });
    }
  }

  onCleanup(() => {
    removeWheelListener?.();
  });

  function handleTrackPointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    const target = (event.composedPath?.()[0] ?? event.target) as Element | null;
    const thumbEl = vertical ? root.thumbYElement() : root.thumbXElement();

    // Ignore clicks on thumb, including cases where the event is retargeted to
    // the track host across a shadow boundary.
    if (thumbEl && target && (thumbEl === target || thumbEl.contains(target))) {
      return;
    }

    const viewportEl = root.viewportElement();
    if (!viewportEl) {
      return;
    }

    const scrollbarEl = vertical ? root.scrollbarYElement() : root.scrollbarXElement();

    if (!thumbEl || !scrollbarEl) {
      return;
    }

    const direction = getViewportDirection();
    const axis = vertical ? "y" : "x";
    const thumbOffset = getOffset(thumbEl, "margin", axis);
    const scrollbarOffset = getOffset(scrollbarEl, "padding", axis);
    const thumbSizePx = vertical ? thumbEl.offsetHeight : thumbEl.offsetWidth;
    const trackRect = scrollbarEl.getBoundingClientRect();
    const clickPosition = vertical
      ? event.clientY - trackRect.top - thumbSizePx / 2 - scrollbarOffset + thumbOffset / 2
      : event.clientX - trackRect.left - thumbSizePx / 2 - scrollbarOffset + thumbOffset / 2;

    const scrollableSize = vertical ? viewportEl.scrollHeight : viewportEl.scrollWidth;
    const viewportSize = vertical ? viewportEl.clientHeight : viewportEl.clientWidth;
    const trackSize = vertical ? scrollbarEl.offsetHeight : scrollbarEl.offsetWidth;

    const maxThumbOffset = trackSize - thumbSizePx - scrollbarOffset - thumbOffset;
    // A short or heavily padded track can drive `maxThumbOffset` to zero or
    // negative once the thumb hits its `MIN_THUMB_SIZE` floor. Dividing by it
    // would yield a non-finite (`Infinity`/`NaN`) or inverted scroll position.
    if (maxThumbOffset <= 0) {
      return;
    }

    const scrollRatio = clickPosition / maxThumbOffset;
    const maxScrollDistance = scrollableSize - viewportSize;

    // Disable snapping before the jump-to-click assignment, or the
    // assigned position quantizes to the nearest snap point and the thumb
    // stays offset from the pointer for the whole drag. `handlePointerDown`
    // below re-runs this as a guarded no-op for the thumb-drag path.
    root.disableViewportSnap();

    if (vertical) {
      viewportEl.scrollTop = scrollRatio * maxScrollDistance;
    } else if (direction === "rtl") {
      viewportEl.scrollLeft = -(1 - scrollRatio) * maxScrollDistance;
    } else {
      viewportEl.scrollLeft = scrollRatio * maxScrollDistance;
    }

    root.handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });

    root.handlePointerDown(event);
  }

  // Native scrollbars don't move focus when pressed, whichever button is used.
  // Handled here rather than on the thumb so the bubbled press covers both.
  function handleMouseDown(event: MouseEvent) {
    event.preventDefault();
  }

  // The provider wraps the element (rather than living inside the tag): the thumb
  // needs both the root and the scrollbar context, and context does not flow through
  // dynamicElement — children read inside the tag would only see the scrollbar
  // provider. Reading them in ScrollAreaScrollbarElement below keeps both providers
  // visible. Deliberately not hoisted: `props.children` must be read in the
  // element body, not here.
  return (
    <ScrollAreaScrollbarContext value={orientation}>
      <ScrollAreaScrollbarElement
        elementProps={props}
        orientation={orientation}
        setScrollbarRef={setScrollbarRef}
        onTrackPointerDown={handleTrackPointerDown}
        onMouseDownInternal={handleMouseDown}
      >
        {props.children}
      </ScrollAreaScrollbarElement>
    </ScrollAreaScrollbarContext>
  );
}

/**
 * Renders the scrollbar element inside the scrollbar context. Split from
 * `ScrollAreaScrollbar` so the thumb is created under both the root and the
 * scrollbar providers: reading the children getter in `ScrollAreaScrollbar` itself
 * would instantiate them before the scrollbar provider exists, and reading it
 * inside the tag would cut off the root provider (context does not flow through
 * dynamicElement).
 */
function ScrollAreaScrollbarElement<T extends JSX.ElementType>(props: ScrollAreaScrollbarElementProps<T>) {
  const outer = props.elementProps;
  const rest = omitProps(outer, "as", "orientation", "keepMounted", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const root = useScrollAreaRootContext();

  const orientation = props.orientation;
  const vertical = orientation === "vertical";

  function snapshot(): ScrollAreaScrollbarState {
    return {
      ...root.rootStateSnapshot(),
      hovering: root.hovering(),
      scrolling: vertical ? root.scrollingY() : root.scrollingX(),
      orientation,
    };
  }

  function hideTrackUntilMeasured(): boolean {
    return !root.hasMeasuredScrollbar() && !(outer.keepMounted ?? false);
  }

  function isHidden(): boolean {
    return vertical ? root.hiddenState().y : root.hiddenState().x;
  }

  function shouldRender(): boolean {
    return (outer.keepMounted ?? false) || !isHidden();
  }

  function scrollbarStyle(): Record<string, string | undefined> {
    const thumb = root.thumbSize();

    return {
      position: "absolute",
      // NB: kebab-case is required. Object styles are applied via `CSSStyleDeclaration.setProperty`,
      // which silently ignores camelCase names.
      "touch-action": "none",
      "-webkit-user-select": "none",
      "user-select": "none",
      visibility: hideTrackUntilMeasured() ? "hidden" : undefined,
      ...(vertical
        ? {
            top: "0px",
            bottom: `var(${scrollAreaCornerHeight})`,
            "inset-inline-end": "0px",
            [scrollAreaThumbHeight]: `${thumb.height}px`,
          }
        : {
            "inset-inline-start": "0px",
            "inset-inline-end": `var(${scrollAreaCornerWidth})`,
            bottom: "0px",
            [scrollAreaThumbWidth]: `${thumb.width}px`,
          }),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => outer.as ?? "div");

  // The tag is built lazily (only while shown) and cached: the shared children
  // binding re-evaluates this branch whenever any sibling's dependencies change,
  // and rebuilding the tag would recreate the scrollbar on every such update.
  // Built under this owner (not the evaluating binding) so later re-runs of that
  // binding reuse the cached node instead of disposing and rebuilding it.
  const owner = getOwner();
  let tagNode: JSX.Element | undefined;

  function renderTag(): JSX.Element {
    if (tagNode === undefined) {
      tagNode = runWithOwner(
        owner,
        () =>
          evaluateTag(
            <Tag
              {...(rest as Record<string, unknown>)}
              aria-hidden="true"
              onPointerDown={outer.onPointerDown ?? props.onTrackPointerDown}
              onMouseDown={outer.onMouseDown ?? props.onMouseDownInternal}
              onPointerUp={outer.onPointerUp ?? root.handlePointerUp}
              // Mirror `onPointerUp` so a browser-cancelled gesture on the track (no thumb
              // child captures the pointer) still clears the drag state.
              onPointerCancel={outer.onPointerCancel ?? root.handlePointerUp}
              data-orientation={orientation}
              data-hovering={root.hovering() ? "" : undefined}
              data-scrolling={(vertical ? root.scrollingY() : root.scrollingX()) ? "" : undefined}
              data-has-overflow-x={root.hiddenState().x ? undefined : ""}
              data-has-overflow-y={root.hiddenState().y ? undefined : ""}
              data-overflow-x-start={root.overflowEdges().xStart ? "" : undefined}
              data-overflow-x-end={root.overflowEdges().xEnd ? "" : undefined}
              data-overflow-y-start={root.overflowEdges().yStart ? "" : undefined}
              data-overflow-y-end={root.overflowEdges().yEnd ? "" : undefined}
              class={resolveClassValue(outer.class, snapshot())}
              style={mergeStyleValue(scrollbarStyle(), resolveStyleValue(outer.style, snapshot()))}
              ref={mergeRefs(props.setScrollbarRef, outer.ref as ((element: HTMLElement | null) => void) | undefined)}
            >
              {resolveScrollbarChildren(children, snapshot)}
            </Tag>,
          ),
      );
    }

    return tagNode;
  }

  return <>{shouldRender() && renderTag()}</>;
}

/**
 * Resolves the scrollbar children. Render-prop children are invoked inside a thunk (bound
 * by the renderer) and re-invoked with a fresh state snapshot whenever the scroll area
 * state changes. The thunk re-enters this owner so the rendered thumb keeps both the
 * root and the scrollbar context (the renderer would otherwise evaluate it detached).
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
function resolveScrollbarChildren(children: ChildrenValue<ScrollAreaScrollbarState> | undefined, snapshot: () => ScrollAreaScrollbarState): JSX.Element {
  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: ScrollAreaScrollbarState) => JSX.Element;
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

interface ScrollAreaScrollbarElementProps<T extends JSX.ElementType> {
  elementProps: ScrollAreaScrollbar.Props<T>;
  orientation: Orientation;
  setScrollbarRef: (element: HTMLElement | null) => void;
  onTrackPointerDown: (event: PointerEvent) => void;
  onMouseDownInternal: (event: MouseEvent) => void;
  children?: ChildrenValue<ScrollAreaScrollbarState> | undefined;
}

export interface ScrollAreaScrollbarState extends ScrollAreaRootState {
  /**
   * Whether the scroll area is being hovered.
   */
  hovering: boolean;
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The orientation of the scrollbar.
   */
  orientation: Orientation;
}

export interface ScrollAreaScrollbarOwnProps {
  /**
   * Whether the scrollbar controls vertical or horizontal scroll.
   * @default 'vertical'
   */
  orientation?: Orientation | undefined;
  /**
   * Whether to keep the HTML element in the DOM when the viewport isn't scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Handler for the scrollbar's `pointerdown` event. Replaces the built-in
   * jump-to-click and drag handling.
   */
  onPointerDown?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
  /**
   * Handler for the scrollbar's `mousedown` event. Replaces the built-in
   * focus prevention.
   */
  onMouseDown?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
}

export type ScrollAreaScrollbarProps<T extends JSX.ElementType = "div"> = ScrollAreaScrollbarOwnProps &
  RebaseUIComponentProps<T, ScrollAreaScrollbarState>;

export namespace ScrollAreaScrollbar {
  export type State = ScrollAreaScrollbarState;
  export type Props<T extends JSX.ElementType = "div"> = ScrollAreaScrollbarProps<T>;
  export type OwnProps = ScrollAreaScrollbarOwnProps;
}

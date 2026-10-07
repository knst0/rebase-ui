import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, onCleanup, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { Orientation, RebaseUIComponentProps } from "../../internals/types";
import type { ScrollAreaRootState } from "../root/ScrollAreaRoot";
import { useScrollAreaRootContext } from "../root/ScrollAreaRootContext";
import { scrollAreaCornerHeight, scrollAreaCornerWidth } from "../root/ScrollAreaRootCssVars";
import { scrollAreaStateAttributesMapping } from "../root/stateAttributesMapping";
import { addEventListener } from "../utils/addEventListener";
import { getOffset } from "../utils/getOffset";
import { ScrollAreaScrollbarContext } from "./ScrollAreaScrollbarContext";
import { scrollAreaThumbHeight, scrollAreaThumbWidth } from "./ScrollAreaScrollbarCssVars";

/**
 * A vertical or horizontal scrollbar for the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Scroll Area](https://rebase-ui.knst.dev/components/scroll-area)
 */
export function ScrollAreaScrollbar<T extends ValidComponent = "div">(props: ScrollAreaScrollbar.Props<T>) {
  const [local, elementProps] = split(props as ScrollAreaScrollbar.Props, { default: defaultProps }, ["as", "orientation", "keepMounted"]);

  const as = untrack(() => local.as);

  const {
    hovering,
    scrollingX,
    scrollingY,
    hiddenState,
    scrollbarYElement,
    setScrollbarYElement,
    scrollbarXElement,
    setScrollbarXElement,
    viewportElement,
    thumbYElement,
    thumbXElement,
    handlePointerDown,
    handlePointerUp,
    handleScroll,
    disableViewportSnap,
    thumbSize,
    hasMeasuredScrollbar,
    viewportState,
  } = useScrollAreaRootContext();

  // Structural: the axis a scrollbar controls never changes without remounting.
  const orientation = untrack(() => local.orientation);
  const vertical = orientation === "vertical";

  const state: ScrollAreaScrollbarState = {
    ...viewportState,
    hovering,
    scrolling: (() => (vertical ? scrollingY() : scrollingX())) as Accessor<boolean>,
    orientation: (() => orientation) as Accessor<Orientation>,
  };

  const hideTrackUntilMeasured = () => !hasMeasuredScrollbar() && !local.keepMounted;
  const isHidden = () => (vertical ? hiddenState().y : hiddenState().x);
  const shouldRender = () => local.keepMounted || !isHidden();

  function getViewportDirection(): "ltr" | "rtl" {
    const viewportEl = viewportElement();
    if (viewportEl == null || typeof getComputedStyle !== "function") {
      return "ltr";
    }

    return getComputedStyle(viewportEl).direction === "rtl" ? "rtl" : "ltr";
  }

  function handleWheel(event: WheelEvent) {
    const viewportEl = viewportElement();
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

    handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });
  }

  let removeWheelListener: (() => void) | undefined;

  function setScrollbarRef(element: HTMLElement | null) {
    if (vertical) {
      setScrollbarYElement(element);
    } else {
      setScrollbarXElement(element);
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
    const thumbEl = vertical ? thumbYElement() : thumbXElement();

    // Ignore clicks on thumb, including cases where the event is retargeted to
    // the track host across a shadow boundary.
    if (thumbEl && target && (thumbEl === target || thumbEl.contains(target))) {
      return;
    }

    const viewportEl = viewportElement();
    if (!viewportEl) {
      return;
    }

    const scrollbarEl = vertical ? scrollbarYElement() : scrollbarXElement();

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
    disableViewportSnap();

    if (vertical) {
      viewportEl.scrollTop = scrollRatio * maxScrollDistance;
    } else if (direction === "rtl") {
      viewportEl.scrollLeft = -(1 - scrollRatio) * maxScrollDistance;
    } else {
      viewportEl.scrollLeft = scrollRatio * maxScrollDistance;
    }

    handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });

    handlePointerDown(event);
  }

  // Native scrollbars don't move focus when pressed, whichever button is used.
  // Handled here rather than on the thumb so the bubbled press covers both.
  function handleMouseDown(event: MouseEvent) {
    event.preventDefault();
  }

  const scrollbarStyle = (): JSX.CSSProperties => {
    const thumb = thumbSize();

    return {
      position: "absolute",
      // NB: kebab-case is required. Solid applies object styles via `CSSStyleDeclaration.setProperty`,
      // which silently ignores camelCase names.
      "touch-action": "none",
      "-webkit-user-select": "none",
      "user-select": "none",
      visibility: hideTrackUntilMeasured() ? "hidden" : undefined,
      ...(vertical
        ? {
            top: 0,
            bottom: `var(${scrollAreaCornerHeight})`,
            "inset-inline-end": 0,
            [scrollAreaThumbHeight]: `${thumb.height}px`,
          }
        : {
            "inset-inline-start": 0,
            "inset-inline-end": `var(${scrollAreaCornerWidth})`,
            bottom: 0,
            [scrollAreaThumbWidth]: `${thumb.width}px`,
          }),
    } as JSX.CSSProperties;
  };

  return (
    <ScrollAreaScrollbarContext value={orientation}>
      <RenderElement
        as={as}
        state={state}
        enabled={shouldRender}
        props={[
          {
            "aria-hidden": "true",
            onPointerDown: handleTrackPointerDown,
            onMouseDown: handleMouseDown,
            onPointerUp: handlePointerUp,
            // Mirror `onPointerUp` so a browser-cancelled gesture on the track (no thumb
            // child captures the pointer) still clears the drag state.
            onPointerCancel: handlePointerUp,
            get style() {
              return scrollbarStyle();
            },
          },
          elementProps,
          {
            ref: setScrollbarRef,
          },
        ]}
        stateAttributesMapping={scrollAreaStateAttributesMapping}
      />
    </ScrollAreaScrollbarContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  orientation: "vertical",
  keepMounted: false,
} satisfies Partial<ScrollAreaScrollbar.Props>);

export interface ScrollAreaScrollbarState extends ScrollAreaRootState {
  /**
   * Whether the scroll area is being hovered.
   */
  hovering: Accessor<boolean>;
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: Accessor<boolean>;
  /**
   * The orientation of the scrollbar.
   */
  orientation: Accessor<Orientation>;
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
}

export type ScrollAreaScrollbarProps<T extends ValidComponent = "div"> = ScrollAreaScrollbarOwnProps &
  RebaseUIComponentProps<T, ScrollAreaScrollbarState>;

export namespace ScrollAreaScrollbar {
  export type State = ScrollAreaScrollbarState;
  export type Props<T extends ValidComponent = "div"> = ScrollAreaScrollbarProps<T>;
  export type OwnProps = ScrollAreaScrollbarOwnProps;
}

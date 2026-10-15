import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { Orientation, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { useScrollAreaRootContext } from "../root/ScrollAreaRootContext";
import { useScrollAreaScrollbarContext } from "../scrollbar/ScrollAreaScrollbarContext";
import { evaluateTag } from "../utils/evaluateTag";

/**
 * The draggable part of the scrollbar that indicates the current scroll position.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Scroll Area](https://rebase-ui.knst.dev/components/scroll-area)
 */
export function ScrollAreaThumb<T extends JSX.ElementType = "div">(props: ScrollAreaThumb.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const root = useScrollAreaRootContext();
  const orientation = useScrollAreaScrollbarContext();
  const vertical = orientation === "vertical";

  function snapshot(): ScrollAreaThumbState {
    return {
      scrolling: vertical ? root.scrollingY() : root.scrollingX(),
      orientation,
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const tag = (
    <Tag
      {...(rest as Record<string, unknown>)}
      onPointerDown={props.onPointerDown ?? root.handlePointerDown}
      onPointerMove={props.onPointerMove ?? root.handlePointerMove}
      onPointerUp={props.onPointerUp ?? root.handlePointerUp}
      onPointerCancel={props.onPointerCancel ?? root.handlePointerUp}
      data-orientation={orientation}
      data-scrolling={(vertical ? root.scrollingY() : root.scrollingX()) ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(
        {
          visibility: root.hasMeasuredScrollbar() ? undefined : "hidden",
          // NB: kebab-case is required. Object styles are applied via `CSSStyleDeclaration.setProperty`,
          // which silently ignores camelCase names.
          height: vertical ? "var(--scroll-area-thumb-height)" : undefined,
          width: vertical ? undefined : "var(--scroll-area-thumb-width)",
        },
        resolveStyleValue(props.style, snapshot()),
      )}
      ref={mergeRefs(
        vertical ? root.setThumbYElement : root.setThumbXElement,
        props.ref as ((element: HTMLElement | null) => void) | undefined,
      )}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );

  // The tag is evaluated eagerly so the tree holds a stable node: re-evaluating it
  // (e.g. when a sibling binding re-runs) would recreate the thumb.
  return evaluateTag(tag);
}

export interface ScrollAreaThumbState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The component orientation.
   */
  orientation: Orientation;
}

export interface ScrollAreaThumbOwnProps {
  /**
   * Handler for the thumb's `pointerdown` event. Replaces the built-in
   * drag handling.
   */
  onPointerDown?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
}

export type ScrollAreaThumbProps<T extends JSX.ElementType = "div"> = ScrollAreaThumbOwnProps &
  RebaseUIComponentProps<T, ScrollAreaThumbState>;

export namespace ScrollAreaThumb {
  export type State = ScrollAreaThumbState;
  export type Props<T extends JSX.ElementType = "div"> = ScrollAreaThumbProps<T>;
  export type OwnProps = ScrollAreaThumbOwnProps;
}

import { type Accessor, untrack } from "solid-js";
import type { ValidComponent } from "@solidjs/web";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { Orientation, RebaseUIComponentProps } from "../../internals/types";
import { useScrollAreaRootContext } from "../root/ScrollAreaRootContext";
import { useScrollAreaScrollbarContext } from "../scrollbar/ScrollAreaScrollbarContext";

/**
 * The draggable part of the scrollbar that indicates the current scroll position.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Scroll Area](https://rebase-ui.knst.dev/components/scroll-area)
 */
export function ScrollAreaThumb<T extends ValidComponent = "div">(props: ScrollAreaThumb.Props<T>) {
  const [local, elementProps] = split(props as ScrollAreaThumb.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { setThumbYElement, setThumbXElement, handlePointerDown, handlePointerMove, handlePointerUp, scrollingX, scrollingY, hasMeasuredScrollbar } =
    useScrollAreaRootContext();

  const orientation = useScrollAreaScrollbarContext();
  const vertical = orientation === "vertical";

  const state: ScrollAreaThumbState = {
    scrolling: (() => (vertical ? scrollingY() : scrollingX())) as Accessor<boolean>,
    orientation: (() => orientation) as Accessor<Orientation>,
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        {
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
          onPointerCancel: handlePointerUp,
          style: {
            get visibility() {
              return hasMeasuredScrollbar() ? undefined : "hidden";
            },
            // NB: kebab-case is required. Solid applies object styles via `CSSStyleDeclaration.setProperty`,
            // which silently ignores camelCase names.
            get height() {
              return vertical ? "var(--scroll-area-thumb-height)" : undefined;
            },
            get width() {
              return vertical ? undefined : "var(--scroll-area-thumb-width)";
            },
          },
        },
        elementProps,
        {
          ref: vertical ? setThumbYElement : setThumbXElement,
        },
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ScrollAreaThumb.Props>);

export interface ScrollAreaThumbState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: Accessor<boolean>;
  /**
   * The component orientation.
   */
  orientation: Accessor<Orientation>;
}

export type ScrollAreaThumbProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ScrollAreaThumbState>;

export namespace ScrollAreaThumb {
  export type State = ScrollAreaThumbState;
  export type Props<T extends ValidComponent = "div"> = ScrollAreaThumbProps<T>;
}

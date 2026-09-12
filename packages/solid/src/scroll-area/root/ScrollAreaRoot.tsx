import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { DISABLE_SCROLLBAR_CSS } from "../utils/disableScrollbar";
import { ScrollAreaRootContext } from "./ScrollAreaRootContext";
import { scrollAreaCornerHeight, scrollAreaCornerWidth } from "./ScrollAreaRootCssVars";
import { createScrollAreaRoot } from "./createScrollAreaRoot";
import { scrollAreaStateAttributesMapping } from "./stateAttributesMapping";

export type Size = {
  width: number;
  height: number;
};

export type Coords = {
  x: number;
  y: number;
};

export type HiddenState = {
  x: boolean;
  y: boolean;
  corner: boolean;
};

export type OverflowEdges = {
  xStart: boolean;
  xEnd: boolean;
  yStart: boolean;
  yEnd: boolean;
};

/**
 * Groups all parts of the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Scroll Area](https://rebase-ui.knst.dev/components/scroll-area)
 */
export function ScrollAreaRoot<T extends ValidComponent = "div">(props: ScrollAreaRoot.Props<T>) {
  const [local, elementProps] = split(props as ScrollAreaRoot.Props, { default: defaultProps }, ["as", "overflowEdgeThreshold"]);

  const as = untrack(() => local.as);

  const contextValue = createScrollAreaRoot({
    overflowEdgeThreshold: local.overflowEdgeThreshold,
  });

  const state = contextValue.viewportState;

  return (
    <ScrollAreaRootContext value={contextValue}>
      <style>{DISABLE_SCROLLBAR_CSS}</style>
      <RenderElement
        as={as}
        state={state}
        props={[
          {
            role: "presentation",
            onPointerEnter: contextValue.handlePointerEnterOrMove,
            onPointerMove: contextValue.handlePointerEnterOrMove,
            onPointerDown: contextValue.handleTouchModalityChange,
            onPointerLeave: contextValue.handlePointerLeave,
            style: {
              position: "relative",
              // NB: kebab-case is required. Solid applies object styles via `CSSStyleDeclaration.setProperty`,
              // which silently ignores camelCase names.
              get [scrollAreaCornerHeight]() {
                return `${contextValue.cornerSize().height}px`;
              },
              get [scrollAreaCornerWidth]() {
                return `${contextValue.cornerSize().width}px`;
              },
            } as JSX.CSSProperties,
          },
          elementProps,
          {
            ref: contextValue.setRootElement,
          },
        ]}
        stateAttributesMapping={scrollAreaStateAttributesMapping}
      />
    </ScrollAreaRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ScrollAreaRoot.Props>);

export interface ScrollAreaRootState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: Accessor<boolean>;
  /**
   * Whether horizontal overflow is present.
   */
  hasOverflowX: Accessor<boolean>;
  /**
   * Whether vertical overflow is present.
   */
  hasOverflowY: Accessor<boolean>;
  /**
   * Whether there is overflow on the inline start side for the horizontal axis.
   */
  overflowXStart: Accessor<boolean>;
  /**
   * Whether there is overflow on the inline end side for the horizontal axis.
   */
  overflowXEnd: Accessor<boolean>;
  /**
   * Whether there is overflow on the block start side.
   */
  overflowYStart: Accessor<boolean>;
  /**
   * Whether there is overflow on the block end side.
   */
  overflowYEnd: Accessor<boolean>;
  /**
   * Whether the scrollbar corner is hidden.
   */
  cornerHidden: Accessor<boolean>;
}

export interface ScrollAreaRootOwnProps {
  /**
   * The threshold in pixels that must be passed before the overflow edge attributes are applied.
   * Accepts a single number for all edges or an object to configure them individually.
   * @default 0
   */
  overflowEdgeThreshold?:
    | number
    | Partial<{
        xStart: number;
        xEnd: number;
        yStart: number;
        yEnd: number;
      }>
    | undefined;
}

export type ScrollAreaRootProps<T extends ValidComponent = "div"> = ScrollAreaRootOwnProps & RebaseUIComponentProps<T, ScrollAreaRootState>;

export namespace ScrollAreaRoot {
  export type State = ScrollAreaRootState;
  export type Props<T extends ValidComponent = "div"> = ScrollAreaRootProps<T>;
  export type OwnProps = ScrollAreaRootOwnProps;
  export type Coords = { x: number; y: number };
  export type HiddenState = { x: boolean; y: boolean; corner: boolean };
  export type OverflowEdges = { xStart: boolean; xEnd: boolean; yStart: boolean; yEnd: boolean };
  export type Size = { width: number; height: number };
}

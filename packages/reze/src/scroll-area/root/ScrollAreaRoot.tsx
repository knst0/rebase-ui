import { dynamicElement, getOwner, omitProps, runWithOwner, untrack, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { DISABLE_SCROLLBAR_CSS } from "../utils/disableScrollbar";
import { evaluateTag } from "../utils/evaluateTag";
import { createScrollAreaRoot } from "./createScrollAreaRoot";
import { ScrollAreaRootContext, useScrollAreaRootContext } from "./ScrollAreaRootContext";
import { scrollAreaCornerHeight, scrollAreaCornerWidth } from "./ScrollAreaRootCssVars";

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
export function ScrollAreaRoot<T extends JSX.ElementType = "div">(props: ScrollAreaRoot.Props<T>) {
  const rest = omitProps(props, "as", "overflowEdgeThreshold", "class", "style", "children", "ref");

  const root = createScrollAreaRoot({
    overflowEdgeThreshold: untrack(() => props.overflowEdgeThreshold),
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the scroll area parts without context. Children
  // resolve in ScrollAreaRootContent below so they are created inside the provider.
  const tag = (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      onPointerEnter={props.onPointerEnter ?? root.handlePointerEnterOrMove}
      onPointerMove={props.onPointerMove ?? root.handlePointerEnterOrMove}
      onPointerDown={props.onPointerDown ?? root.handleTouchModalityChange}
      onPointerLeave={props.onPointerLeave ?? root.handlePointerLeave}
      data-scrolling={root.scrollingX() || root.scrollingY() ? "" : undefined}
      data-has-overflow-x={root.hiddenState().x ? undefined : ""}
      data-has-overflow-y={root.hiddenState().y ? undefined : ""}
      data-overflow-x-start={root.overflowEdges().xStart ? "" : undefined}
      data-overflow-x-end={root.overflowEdges().xEnd ? "" : undefined}
      data-overflow-y-start={root.overflowEdges().yStart ? "" : undefined}
      data-overflow-y-end={root.overflowEdges().yEnd ? "" : undefined}
      class={resolveClassValue(props.class, root.rootStateSnapshot())}
      style={mergeStyleValue(
        {
          position: "relative",
          // NB: kebab-case is required. Object styles are applied via `CSSStyleDeclaration.setProperty`,
          // which silently ignores camelCase names.
          [scrollAreaCornerHeight]: `${root.cornerSize().height}px`,
          [scrollAreaCornerWidth]: `${root.cornerSize().width}px`,
        },
        resolveStyleValue(props.style, root.rootStateSnapshot()),
      )}
      ref={mergeRefs(root.setRootElement, props.ref as ((element: HTMLElement | null) => void) | undefined)}
    >
      <ScrollAreaRootContext value={root}>
        <ScrollAreaRootContent>{props.children}</ScrollAreaRootContent>
      </ScrollAreaRootContext>
    </Tag>
  );

  // The tag is evaluated eagerly so the tree holds a stable node: re-evaluating it
  // (e.g. when a sibling binding re-runs) would rebuild every scroll area part.
  return (
    <>
      <style>{DISABLE_SCROLLBAR_CSS}</style>
      {evaluateTag(tag)}
    </>
  );
}

/**
 * Resolves the root children inside the scroll area context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the scroll area state changes.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function ScrollAreaRootContent(props: { children: ChildrenValue<ScrollAreaRootState> }) {
  const children = props.children;

  const root = useScrollAreaRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: ScrollAreaRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the scroll area context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot = root.rootStateSnapshot();

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface ScrollAreaRootState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * Whether horizontal overflow is present.
   */
  hasOverflowX: boolean;
  /**
   * Whether vertical overflow is present.
   */
  hasOverflowY: boolean;
  /**
   * Whether there is overflow on the inline start side for the horizontal axis.
   */
  overflowXStart: boolean;
  /**
   * Whether there is overflow on the inline end side for the horizontal axis.
   */
  overflowXEnd: boolean;
  /**
   * Whether there is overflow on the block start side.
   */
  overflowYStart: boolean;
  /**
   * Whether there is overflow on the block end side.
   */
  overflowYEnd: boolean;
  /**
   * Whether the scrollbar corner is hidden.
   */
  cornerHidden: boolean;
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
  /**
   * Handler for the root's `pointerdown` event. Replaces the built-in
   * touch-modality tracking.
   */
  onPointerDown?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
}

export type ScrollAreaRootProps<T extends JSX.ElementType = "div"> = ScrollAreaRootOwnProps &
  RebaseUIComponentProps<T, ScrollAreaRootState>;

export namespace ScrollAreaRoot {
  export type State = ScrollAreaRootState;
  export type Props<T extends JSX.ElementType = "div"> = ScrollAreaRootProps<T>;
  export type OwnProps = ScrollAreaRootOwnProps;
  export type Coords = { x: number; y: number };
  export type HiddenState = { x: boolean; y: boolean; corner: boolean };
  export type OverflowEdges = { xStart: boolean; xEnd: boolean; yStart: boolean; yEnd: boolean };
  export type Size = { width: number; height: number };
}

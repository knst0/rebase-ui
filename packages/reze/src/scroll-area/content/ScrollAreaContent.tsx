import { dynamicElement, omitProps, onCleanup, untrack, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ScrollAreaRootState } from "../root/ScrollAreaRoot";
import { useScrollAreaRootContext } from "../root/ScrollAreaRootContext";
import { evaluateTag } from "../utils/evaluateTag";
import { useScrollAreaViewportContext } from "../viewport/ScrollAreaViewportContext";

/**
 * A container for the content of the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Scroll Area](https://rebase-ui.knst.dev/components/scroll-area)
 */
export function ScrollAreaContent<T extends JSX.ElementType = "div">(props: ScrollAreaContent.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { computeThumbPosition } = useScrollAreaViewportContext();
  const root = useScrollAreaRootContext();

  let resizeObserver: ResizeObserver | undefined;
  // One-time snapshot: whether the viewport already measured before this content
  // mounted. Read explicitly untracked; the component body is not a tracking scope.
  const computeOnInitialResize = untrack(root.hasMeasuredScrollbar);

  function setContentRef(element: HTMLElement | null) {
    resizeObserver?.disconnect();
    resizeObserver = undefined;

    if (typeof ResizeObserver === "undefined" || !element) {
      return;
    }

    let hasInitialized = false;
    resizeObserver = new ResizeObserver(() => {
      if (!hasInitialized) {
        hasInitialized = true;

        // ResizeObserver fires once upon observing. Skip that initial call to avoid
        // double-calculating the thumb position on mount, unless the content mounted
        // after the viewport's initial measurement (in which case this fire is what
        // brings the overflow state in sync).
        if (!computeOnInitialResize) {
          return;
        }
      }

      computeThumbPosition();
    });

    resizeObserver.observe(element);
  }

  onCleanup(() => {
    resizeObserver?.disconnect();
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const tag = (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
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
          // NB: kebab-case is required. Object styles are applied via `CSSStyleDeclaration.setProperty`,
          // which silently ignores camelCase names.
          "min-width": "fit-content",
        },
        resolveStyleValue(props.style, root.rootStateSnapshot()),
      )}
      ref={mergeRefs(setContentRef, props.ref as ((element: HTMLElement | null) => void) | undefined)}
    >
      {resolveChildrenValue(children, () => root.rootStateSnapshot())}
    </Tag>
  );

  // The tag is evaluated eagerly so the tree holds a stable node: re-evaluating it
  // (e.g. when a sibling binding re-runs) would recreate the content element.
  return evaluateTag(tag);
}

export interface ScrollAreaContentState extends ScrollAreaRootState {}

export type ScrollAreaContentProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ScrollAreaContentState>;

export namespace ScrollAreaContent {
  export type State = ScrollAreaContentState;
  export type Props<T extends JSX.ElementType = "div"> = ScrollAreaContentProps<T>;
}

import type { ValidComponent } from "@solidjs/web";
import { onSettled, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ScrollAreaRootState } from "../root/ScrollAreaRoot";
import { useScrollAreaRootContext } from "../root/ScrollAreaRootContext";
import { scrollAreaStateAttributesMapping } from "../root/stateAttributesMapping";
import { useScrollAreaViewportContext } from "../viewport/ScrollAreaViewportContext";

/**
 * A container for the content of the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Scroll Area](https://rebase-ui.knst.dev/components/scroll-area)
 */
export function ScrollAreaContent<T extends ValidComponent = "div">(props: ScrollAreaContent.Props<T>) {
  const [local, elementProps] = split(props as ScrollAreaContent.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { computeThumbPosition } = useScrollAreaViewportContext();
  const { hasMeasuredScrollbar, viewportState } = useScrollAreaRootContext();

  let contentWrapper: HTMLElement | null = null;
  // One-time snapshot: whether the viewport already measured before this content
  // mounted. Read explicitly untracked; the component body is not a tracking scope.
  const computeOnInitialResize = untrack(hasMeasuredScrollbar);

  onSettled(() => {
    if (typeof ResizeObserver === "undefined" || !contentWrapper) {
      return;
    }

    let hasInitialized = false;
    const resizeObserver = new ResizeObserver(() => {
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

    resizeObserver.observe(contentWrapper);

    return () => {
      resizeObserver.disconnect();
    };
  });

  return (
    <RenderElement
      as={as}
      state={viewportState}
      stateAttributesMapping={scrollAreaStateAttributesMapping}
      props={[
        {
          role: "presentation",
          style: {
            // NB: kebab-case is required. Solid applies object styles via `CSSStyleDeclaration.setProperty`,
            // which silently ignores camelCase names.
            "min-width": "fit-content",
          },
        },
        elementProps,
        {
          ref: (element: HTMLElement | null) => {
            contentWrapper = element;
          },
        },
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ScrollAreaContent.Props>);

export interface ScrollAreaContentState extends ScrollAreaRootState {}

export type ScrollAreaContentProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ScrollAreaContentState>;

export namespace ScrollAreaContent {
  export type State = ScrollAreaContentState;
  export type Props<T extends ValidComponent = "div"> = ScrollAreaContentProps<T>;
}

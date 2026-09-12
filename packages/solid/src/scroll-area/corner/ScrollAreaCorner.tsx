import type { ValidComponent } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useScrollAreaRootContext } from "../root/ScrollAreaRootContext";

/**
 * A small rectangular area that appears at the intersection of horizontal and vertical scrollbars.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Scroll Area](https://rebase-ui.knst.dev/components/scroll-area)
 */
export function ScrollAreaCorner<T extends ValidComponent = "div">(props: ScrollAreaCorner.Props<T>) {
  const [local, elementProps] = split(props as ScrollAreaCorner.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { setCornerElement, cornerSize, hiddenState } = useScrollAreaRootContext();

  return (
    <Show when={!hiddenState().corner}>
      <RenderElement
        as={as}
        props={[
          {
            "aria-hidden": "true",
            style: {
              position: "absolute",
              bottom: 0,
              // NB: kebab-case is required. Solid applies object styles via `CSSStyleDeclaration.setProperty`,
              // which silently ignores camelCase names.
              "inset-inline-end": 0,
              get width() {
                // NB: a string is required. The renderer passes style values to
                // `CSSStyleDeclaration.setProperty` as-is, which drops unitless
                // numbers (except `0`).
                return `${cornerSize().width}px`;
              },
              get height() {
                return `${cornerSize().height}px`;
              },
            },
          },
          elementProps,
          {
            ref: setCornerElement,
          },
        ]}
      />
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ScrollAreaCorner.Props>);

export interface ScrollAreaCornerState {}

export type ScrollAreaCornerProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ScrollAreaCornerState>;

export namespace ScrollAreaCorner {
  export type State = ScrollAreaCornerState;
  export type Props<T extends ValidComponent = "div"> = ScrollAreaCornerProps<T>;
}

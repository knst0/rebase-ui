import { dynamicElement, getOwner, omitProps, runWithOwner, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useScrollAreaRootContext } from "../root/ScrollAreaRootContext";
import { evaluateTag } from "../utils/evaluateTag";

/**
 * A small rectangular area that appears at the intersection of horizontal and vertical scrollbars.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Scroll Area](https://rebase-ui.knst.dev/components/scroll-area)
 */
export function ScrollAreaCorner<T extends JSX.ElementType = "div">(props: ScrollAreaCorner.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const root = useScrollAreaRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The tag is built lazily (only while shown) and cached: the shared children
  // binding re-evaluates this branch whenever any sibling's dependencies change,
  // and rebuilding the tag would recreate the corner on every such update.
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
              class={resolveClassValue(props.class, {})}
              style={mergeStyleValue(
                {
                  position: "absolute",
                  bottom: "0px",
                  // NB: kebab-case is required. Object styles are applied via `CSSStyleDeclaration.setProperty`,
                  // which silently ignores camelCase names.
                  "inset-inline-end": "0px",
                  // NB: strings are required. The renderer passes style values to
                  // `CSSStyleDeclaration.setProperty` as-is, which stringifies numbers
                  // without units.
                  width: `${root.cornerSize().width}px`,
                  height: `${root.cornerSize().height}px`,
                },
                resolveStyleValue(props.style, {}),
              )}
              ref={mergeRefs(root.setCornerElement, props.ref as ((element: HTMLElement | null) => void) | undefined)}
            >
              {resolveChildrenValue(children, () => ({}))}
            </Tag>,
          ),
      );
    }

    return tagNode;
  }

  return <>{!root.hiddenState().corner && renderTag()}</>;
}

export interface ScrollAreaCornerState {}

export type ScrollAreaCornerProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ScrollAreaCornerState>;

export namespace ScrollAreaCorner {
  export type State = ScrollAreaCornerState;
  export type Props<T extends JSX.ElementType = "div"> = ScrollAreaCornerProps<T>;
}

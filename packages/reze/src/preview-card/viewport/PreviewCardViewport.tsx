import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createPopupViewport } from "../../internals/popups/popupViewport";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardPositionerContext } from "../positioner/PreviewCardPositionerContext";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardViewport<T extends JSX.ElementType = "div">(props: PreviewCardViewport.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Deliberately not hoisted: the viewport remounts its current container when the
  // trigger changes, and each pass must create fresh content nodes. Reusing a node
  // created once here would reinsert a disposed binding with a stale payload.

  const store = usePreviewCardRootContext();
  const positioner = usePreviewCardPositionerContext();

  function snapshot(): PreviewCardViewportState {
    return {
      activationDirection: viewport.state.activationDirection,
      transitioning: viewport.state.transitioning,
      instant: store.select("instantType"),
    };
  }

  const viewport = createPopupViewport({
    store,
    side: positioner.side,
    // Read on every render pass so a payload change updates the content in place
    // and a trigger change remounts with fresh content nodes.
    children: () => resolveChildrenValue(props.children, snapshot),
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-activation-direction={viewport.state.activationDirection ?? undefined}
      data-transitioning={viewport.state.transitioning ? "" : undefined}
      data-instant={(store.select("instantType") as string | undefined) ?? undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {viewport.children()}
    </Tag>
  );
}

export interface PreviewCardViewportState {
  /**
   * The activation direction of the transitioned content.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
  /**
   * Present if animations should be instant.
   */
  instant: "dismiss" | "focus" | undefined;
}

export type PreviewCardViewportProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, PreviewCardViewportState>;

export namespace PreviewCardViewport {
  export type State = PreviewCardViewportState;
  export type Props<T extends JSX.ElementType = "div"> = PreviewCardViewportProps<T>;
}

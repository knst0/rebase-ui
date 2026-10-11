import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createPopupViewport } from "../../internals/popups/popupViewport";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverPositionerContext } from "../positioner/PopoverPositionerContext";
import { usePopoverRootContext } from "../root/PopoverRootContext";

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverViewport<T extends JSX.ElementType = "div">(props: PopoverViewport.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Deliberately not hoisted: the viewport re-reads its children on every render
  // pass so a payload change updates the content in place instead of freezing
  // the value read while closed.

  const store = usePopoverRootContext();
  const positioner = usePopoverPositionerContext();

  function snapshot(): PopoverViewportState {
    return {
      activationDirection: viewport.state.activationDirection,
      transitioning: viewport.state.transitioning,
      instant: store.select("instantType"),
    };
  }

  const viewport = createPopupViewport({
    store,
    side: positioner.side,
    // Read on every render pass so a payload change updates the content in place.
    children: () => resolveChildrenValue(props.children, snapshot),
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-activation-direction={viewport.state.activationDirection ?? undefined}
      data-transitioning={viewport.state.transitioning ? "" : undefined}
      data-instant={store.select("instantType") ?? undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {() => viewport.children()}
    </Tag>
  );
}

export interface PopoverViewportState {
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
  instant: "dismiss" | "click" | "focus" | "trigger-change" | undefined;
}

export type PopoverViewportProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, PopoverViewportState>;

export namespace PopoverViewport {
  export type State = PopoverViewportState;
  export type Props<T extends JSX.ElementType = "div"> = PopoverViewportProps<T>;
}

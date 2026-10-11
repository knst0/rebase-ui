import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createPopupViewport } from "../../internals/popups/popupViewport";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { useTooltipPositionerContext } from "../positioner/TooltipPositionerContext";
import { useTooltipRootContext } from "../root/TooltipRootContext";

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipViewport<T extends JSX.ElementType = "div">(props: TooltipViewport.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Deliberately not hoisted: the children getter is re-read on every viewport render
  // pass (matching the Solid layer), so a payload change updates dynamic expression
  // children such as `{root.payload}` in place instead of snapshotting them once.

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  function snapshot(): TooltipViewportState {
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

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // captured previous content mid-transition. The default path renders a static `<div>`;
  // only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        data-activation-direction={viewport.state.activationDirection ?? undefined}
        data-transitioning={viewport.state.transitioning ? "" : undefined}
        data-instant={(store.select("instantType") as string | undefined) ?? undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {viewport.children()}
      </div>
    );
  }

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

export interface TooltipViewportState {
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
  instant: "delay" | "dismiss" | "focus" | undefined;
}

export type TooltipViewportProps<T extends JSX.ElementType = "div"> = ButtonEventHandlers & RebaseUIComponentProps<T, TooltipViewportState>;

export namespace TooltipViewport {
  export type State = TooltipViewportState;
  export type Props<T extends JSX.ElementType = "div"> = TooltipViewportProps<T>;
}

import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { createPopupViewport } from "../../internals/popups/popupViewport";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useTooltipPositionerContext } from "../positioner/TooltipPositionerContext";
import { useTooltipRootContext } from "../root/TooltipRootContext";
import { tooltipViewportStateMapping } from "../utils/stateAttributesMapping";

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipViewport<T extends ValidComponent = "div">(props: TooltipViewport.Props<T>) {
  const [local, elementProps] = split(props as TooltipViewport.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  const state: TooltipViewportState = {
    get activationDirection() {
      return viewport.state.activationDirection;
    },
    get transitioning() {
      return viewport.state.transitioning;
    },
    get instant() {
      return store.select("instantType");
    },
  };

  const viewport = createPopupViewport({
    store,
    side: positioner.side,
    // Read on every render pass so a payload change updates the content in place.
    children: () => {
      const value = elementProps.children as JSX.Element | ((state: TooltipViewportState) => JSX.Element);
      return typeof value === "function" ? value(state) : value;
    },
  });

  const childrenProps = {
    get children() {
      return viewport.children();
    },
  };

  return <RenderElement as={as} state={state} props={[elementProps, childrenProps]} stateAttributesMapping={tooltipViewportStateMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<TooltipViewport.Props>);

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

export type TooltipViewportProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, TooltipViewportState>;

export namespace TooltipViewport {
  export type State = TooltipViewportState;
  export type Props<T extends ValidComponent = "div"> = TooltipViewportProps<T>;
}

import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { createPopupViewport } from "../../internals/popups/popupViewport";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverPositionerContext } from "../positioner/PopoverPositionerContext";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import { popoverViewportStateMapping } from "../utils/stateAttributesMapping";

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverViewport<T extends ValidComponent = "div">(props: PopoverViewport.Props<T>) {
  const [local, elementProps] = split(props as PopoverViewport.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = usePopoverRootContext();
  const positioner = usePopoverPositionerContext();

  const state: PopoverViewportState = {
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
      const value = elementProps.children as JSX.Element | ((state: PopoverViewportState) => JSX.Element);
      return typeof value === "function" ? value(state) : value;
    },
  });

  const childrenProps = {
    get children() {
      return viewport.children();
    },
  };

  return <RenderElement as={as} state={state} props={[elementProps, childrenProps]} stateAttributesMapping={popoverViewportStateMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<PopoverViewport.Props>);

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

export type PopoverViewportProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, PopoverViewportState>;

export namespace PopoverViewport {
  export type State = PopoverViewportState;
  export type Props<T extends ValidComponent = "div"> = PopoverViewportProps<T>;
}

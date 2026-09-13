import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { REASONS } from "../../internals/event-details";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import { popoverPopupStateMapping } from "../utils/stateAttributesMapping";

/**
 * An overlay displayed beneath the popover.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverBackdrop<T extends ValidComponent = "div">(props: PopoverBackdrop.Props<T>) {
  const [local, elementProps] = split(props as PopoverBackdrop.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = usePopoverRootContext();

  const state: PopoverBackdropState = {
    get open() {
      return store.select("open");
    },
    get transitionStatus() {
      return store.select("transitionStatus");
    },
  };

  const backdropProps = {
    role: "presentation" as const,
    get hidden() {
      return !store.select("mounted") || undefined;
    },
    get style(): JSX.CSSProperties {
      return {
        "pointer-events": store.select("openChangeReason") === REASONS.triggerHover ? "none" : undefined,
        "user-select": "none",
        "-webkit-user-select": "none",
      };
    },
  };

  return <RenderElement as={as} state={state} props={[backdropProps, elementProps]} stateAttributesMapping={popoverPopupStateMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<PopoverBackdrop.Props>);

export interface PopoverBackdropState {
  /**
   * Whether the popover is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type PopoverBackdropProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, PopoverBackdropState>;

export namespace PopoverBackdrop {
  export type State = PopoverBackdropState;
  export type Props<T extends ValidComponent = "div"> = PopoverBackdropProps<T>;
}

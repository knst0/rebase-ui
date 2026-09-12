import type { JSX } from "@solidjs/web";
import { onSettled, type Setter, untrack } from "solid-js";

import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { stableCallback } from "../../internals/stableCallback";
import type { TooltipHandle } from "../store/TooltipHandle";
import { createTooltipRoot, type TooltipTrackCursorAxis } from "./createTooltipRoot";
import { TooltipRootContext } from "./TooltipRootContext";

/**
 * Groups all parts of the tooltip.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipRoot<Payload = unknown>(props: TooltipRoot.Props<Payload>) {
  const onOpenChange = stableCallback(() => props.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => props.onOpenChangeComplete);

  const tooltip = createTooltipRoot<Payload>({
    defaultOpen: () => props.defaultOpen ?? false,
    disabled: () => props.disabled ?? false,
    disableHoverablePopup: () => props.disableHoverablePopup ?? false,
    onOpenChange,
    onOpenChangeComplete,
    open: () => props.open,
    trackCursorAxis: () => props.trackCursorAxis ?? "none",
    triggerId: () => props.triggerId,
  });

  const handle = untrack(() => props.handle);
  if (handle) {
    // Attaching writes to state owned by the handle, so it must happen outside
    // the component's owned scope once rendering has settled.
    onSettled(() => {
      (handle as TooltipHandle<Payload>).attach(tooltip.store);

      return () => {
        (handle as TooltipHandle<Payload>).detach(tooltip.store);
      };
    });
  }

  const actionsRef = untrack(() => props.actionsRef);
  if (actionsRef) {
    // Delivering the actions is a signal write, so it happens outside the
    // component's owned scope once rendering has settled.
    onSettled(() => {
      actionsRef({
        unmount: tooltip.forceUnmount,
        close: () => {
          tooltip.store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
        },
      });

      return () => {
        actionsRef(null);
      };
    });
  }

  // Creates the children inside the provider (so parts resolve the context) without
  // subscribing to signals read while they are created. Only the payload of
  // render-prop children stays reactive.
  return (
    <TooltipRootContext value={tooltip.store}>
      <TooltipRootContent payload={tooltip.store.useState("payload") as () => Payload | undefined}>{props.children}</TooltipRootContent>
    </TooltipRootContext>
  );
}

/**
 * Renders the root children inside the tooltip context. Reads them once so parts keep
 * stable DOM nodes; only the payload of render-prop children stays reactive.
 */
function TooltipRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = untrack(() => props.children);

  if (typeof children === "function") {
    const payloadChildren = children;
    const payload = props.payload;

    return (() => payloadChildren({ payload: payload() })) as unknown as JSX.Element;
  }

  return children as JSX.Element;
}

export interface TooltipRootState {}

export interface TooltipRootProps<Payload = unknown> {
  /**
   * Whether the tooltip is initially open.
   *
   * To render a controlled tooltip, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the tooltip is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the tooltip is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: TooltipRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the tooltip is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the tooltip contents can be hovered without closing the tooltip.
   * @default false
   */
  disableHoverablePopup?: boolean | undefined;
  /**
   * Determines which axis the tooltip should track the cursor on.
   * @default 'none'
   */
  trackCursorAxis?: TooltipTrackCursorAxis | undefined;
  /**
   * A signal setter that receives the imperative actions.
   * - `unmount`: Manually unmounts the tooltip.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the tooltip imperatively when called.
   */
  actionsRef?: Setter<TooltipRoot.Actions | null> | undefined;
  /**
   * Whether the tooltip is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the tooltip with a trigger.
   * If specified, allows external triggers to control the tooltip's open state.
   * Can be created with the Tooltip.createHandle() method.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * The content of the tooltip.
   * This can be a regular node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled tooltip.
   * There's no need to specify this prop when the tooltip is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
}

export interface TooltipRootActions {
  unmount: () => void;
  close: () => void;
}

export type TooltipRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.disabled
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type TooltipRootChangeEventDetails = RebaseUIChangeEventDetails<
  TooltipRootChangeEventReason,
  {
    preventUnmountOnClose(): void;
  }
>;

export namespace TooltipRoot {
  export type State = TooltipRootState;
  export type Props<Payload = unknown> = TooltipRootProps<Payload>;
  export type Actions = TooltipRootActions;
  export type ChangeEventReason = TooltipRootChangeEventReason;
  export type ChangeEventDetails = TooltipRootChangeEventDetails;
}

import { effect, getOwner, onCleanup, runWithOwner, type JSX } from "reze-js";

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

  const handle = props.handle;
  if (handle) {
    effect(() => {
      (handle as TooltipHandle<Payload>).attach(tooltip.store);

      onCleanup(() => {
        (handle as TooltipHandle<Payload>).detach(tooltip.store);
      });
    });
  }

  const actionsRef = props.actionsRef;
  if (actionsRef) {
    effect(() => {
      actionsRef({
        unmount: tooltip.forceUnmount,
        close: () => {
          tooltip.store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
        },
      });

      onCleanup(() => {
        actionsRef(null);
      });
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
 * Renders the root children inside the tooltip context. Render-prop children are invoked
 * inside a thunk (bound by the renderer) and receive `payload` as a getter, so reading
 * it inside JSX updates the content in place instead of recreating the popup subtree
 * (which would restart its transitions).
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives (such as
 * the branch backing conditional parts) return thunks, and invoking one here would
 * resolve the subtree one-shot instead of binding it.
 */
export function TooltipRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (args: { payload: Payload | undefined }) => JSX.Element;
    const payload = props.payload;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the tooltip context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // The render below runs once: `payload` is exposed as a getter, so only the JSX
      // expressions that read it re-run. Subscribing this binding to the payload would
      // re-invoke the render function and recreate the popup subtree (restarting the
      // open, position and content transitions) every time the trigger changes.
      return runWithOwner(owner, () =>
        render({
          get payload() {
            return payload();
          },
        }),
      );
    };
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
   * A callback that receives the imperative actions.
   * - `unmount`: Manually unmounts the tooltip.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the tooltip imperatively when called.
   */
  actionsRef?: ((actions: TooltipRoot.Actions | null) => void) | undefined;
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

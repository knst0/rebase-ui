import { effect, onCleanup, type JSX } from "reze-js";

import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { stableCallback } from "../../internals/stableCallback";
import type { PopoverHandle } from "../store/PopoverHandle";
import { createPopoverRoot } from "./createPopoverRoot";
import { PopoverRootContext } from "./PopoverRootContext";

/**
 * Groups all parts of the popover.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverRoot<Payload = unknown>(props: PopoverRoot.Props<Payload>) {
  const onOpenChange = stableCallback(() => props.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => props.onOpenChangeComplete);

  const popover = createPopoverRoot<Payload>({
    defaultOpen: () => props.defaultOpen ?? false,
    modal: () => props.modal ?? false,
    onOpenChange,
    onOpenChangeComplete,
    open: () => props.open,
    triggerId: () => props.triggerId,
  });

  const handle = props.handle;
  if (handle) {
    effect(() => {
      (handle as PopoverHandle<Payload>).attach(popover.store);

      onCleanup(() => {
        (handle as PopoverHandle<Payload>).detach(popover.store);
      });
    });
  }

  const actionsRef = props.actionsRef;
  if (actionsRef) {
    effect(() => {
      actionsRef({
        unmount: popover.forceUnmount,
        close: () => {
          popover.store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
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
    <PopoverRootContext value={popover.store}>
      <PopoverRootContent payload={popover.store.useState("payload") as () => Payload | undefined}>{props.children}</PopoverRootContent>
    </PopoverRootContext>
  );
}

/**
 * Renders the root children inside the popover context. Render-prop children are invoked
 * inside a thunk (bound by the renderer) and receive `payload` as a getter, so reading
 * it inside JSX updates the content in place instead of recreating the popup subtree
 * (which would restart the open, position and content transitions).
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function PopoverRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (args: { payload: Payload | undefined }) => JSX.Element;
    const payload = props.payload;

    // Invoked once, returned directly: `payload` is exposed as a getter, so only
    // the JSX expressions that read it update. Never return a thunk here — a
    // returned thunk re-runs on every update, which would recreate the whole
    // popup subtree (positioner, popup, viewport) and restart the open, position
    // and content transitions. Consumers that read the payload re-read it per
    // render pass (see PopoverViewport) or bind it in static positions, so they
    // still update in place.
    return render({
      get payload() {
        return payload();
      },
    });
  }

  return children as JSX.Element;
}

export interface PopoverRootState {}

export interface PopoverRootProps<Payload = unknown> {
  /**
   * Whether the popover is initially open.
   *
   * To render a controlled popover, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popover is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the popover is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: PopoverRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the popover is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * A callback that receives the imperative actions.
   * - `unmount`: Manually unmounts the popover.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the popover imperatively when called.
   */
  actionsRef?: ((actions: PopoverRoot.Actions | null) => void) | undefined;
  /**
   * Determines if the popover enters a modal state when open.
   * - `true`: user interaction is limited to the popover: document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the popover, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   *
   * When `modal` is `true`, focus trapping is enabled only if `<Popover.Close>` is rendered
   * inside `<Popover.Popup>`. It can be visually hidden with your own CSS if needed, such as
   * Tailwind's `sr-only` utility.
   *
   * When `modal` is `'trap-focus'`, render `<Popover.Close>` inside `<Popover.Popup>` so touch
   * screen readers can escape the popup.
   * @default false
   */
  modal?: boolean | "trap-focus" | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled popover.
   * There's no need to specify this prop when the popover is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * A handle to associate the popover with a trigger.
   * If specified, allows external triggers to control the popover's open state.
   * Can be created with the Popover.createHandle() method.
   */
  handle?: PopoverHandle<Payload> | undefined;
  /**
   * The content of the popover.
   * This can be a regular node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
}

export interface PopoverRootActions {
  unmount: () => void;
  close: () => void;
}

export type PopoverRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type PopoverRootChangeEventDetails = RebaseUIChangeEventDetails<
  PopoverRootChangeEventReason,
  {
    preventUnmountOnClose(): void;
  }
>;

export namespace PopoverRoot {
  export type State = PopoverRootState;
  export type Props<Payload = unknown> = PopoverRootProps<Payload>;
  export type Actions = PopoverRootActions;
  export type ChangeEventReason = PopoverRootChangeEventReason;
  export type ChangeEventDetails = PopoverRootChangeEventDetails;
}

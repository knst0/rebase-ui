import type { JSX } from "@solidjs/web";
import { createMemo, onSettled, type Setter, untrack } from "solid-js";

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

  const handle = untrack(() => props.handle);
  if (handle) {
    // Attaching writes to state owned by the handle, so it must happen outside
    // the component's owned scope once rendering has settled.
    onSettled(() => {
      (handle as PopoverHandle<Payload>).attach(popover.store);

      return () => {
        (handle as PopoverHandle<Payload>).detach(popover.store);
      };
    });
  }

  const actionsRef = untrack(() => props.actionsRef);
  if (actionsRef) {
    // Delivering the actions is a signal write, so it happens outside the
    // component's owned scope once rendering has settled.
    onSettled(() => {
      actionsRef({
        unmount: popover.forceUnmount,
        close: () => {
          popover.store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
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
    <PopoverRootContext value={popover.store}>
      <PopoverRootContent payload={popover.store.useState("payload") as () => Payload | undefined}>{props.children}</PopoverRootContent>
    </PopoverRootContext>
  );
}

/**
 * Renders the root children inside the popover context. Render-prop children are invoked
 * once and receive `payload` as a getter, so reading it inside JSX updates the content in
 * place instead of recreating the popup subtree (which would restart the open, position
 * and content transitions).
 */
function PopoverRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = untrack(() => props.children);

  if (typeof children === "function") {
    const payloadChildren = children;
    const payload = props.payload;

    // The children function runs once: `payload` is exposed as a getter, so only the JSX
    // expressions that read it re-run. The memo is the lazy-creation wrapper the runtime
    // expects and it recomputes only if the children function reads the payload
    // synchronously (e.g. destructuring it), which restores the previous remount behaviour.
    const childrenMemo = createMemo(() =>
      payloadChildren({
        get payload() {
          return payload();
        },
      }),
    );
    return (() => childrenMemo()) as unknown as JSX.Element;
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
   * A signal setter that receives the imperative actions.
   * - `unmount`: Manually unmounts the popover.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the popover imperatively when called.
   */
  actionsRef?: Setter<PopoverRoot.Actions | null> | undefined;
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

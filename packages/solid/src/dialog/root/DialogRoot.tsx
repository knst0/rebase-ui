import type { JSX } from "@solidjs/web";
import { createMemo, onSettled, type Setter, untrack } from "solid-js";

import { REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { stableCallback } from "../../internals/stableCallback";
import type { DialogHandle } from "../store/DialogHandle";
import { createDialogRoot } from "./createDialogRoot";
import { DialogRootContext, useDialogRootContext } from "./DialogRootContext";

/**
 * Groups all parts of the dialog.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogRoot<Payload = unknown>(props: DialogRoot.Props<Payload>) {
  const parentContext = useDialogRootContext(true);

  const onOpenChange = stableCallback(() => props.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => props.onOpenChangeComplete);

  const dialog = createDialogRoot({
    defaultOpen: () => props.defaultOpen ?? false,
    disablePointerDismissal: () => props.disablePointerDismissal ?? false,
    modal: () => props.modal ?? true,
    onOpenChange,
    onOpenChangeComplete,
    open: () => props.open,
    parentContext: parentContext ?? undefined,
    role: "dialog",
    triggerId: () => props.triggerId,
  });

  const handle = untrack(() => props.handle);
  if (handle) {
    // Attaching writes to state owned by the handle, so it must happen outside
    // the component's owned scope once rendering has settled.
    onSettled(() => {
      dialog.attachHandle(handle);

      return () => {
        dialog.detachHandle(handle);
      };
    });
  }

  const actionsRef = untrack(() => props.actionsRef);
  if (actionsRef) {
    // Delivering the actions is a signal write, so it happens outside the
    // component's owned scope once rendering has settled.
    onSettled(() => {
      actionsRef({
        unmount: dialog.forceUnmount,
        close: dialog.requestClose,
      });

      return () => {
        actionsRef(null);
      };
    });
  }

  // Creates the children inside the provider (so parts resolve the context) without
  // subscribing to signals read while they are created (e.g. `store.mounted()` read by
  // `<Show>` in the portal would otherwise re-create the whole subtree on every open).
  // Only the payload of render-prop children stays reactive.
  return (
    <DialogRootContext value={dialog}>
      <DialogRootContent payload={dialog.payload as () => Payload | undefined}>{props.children}</DialogRootContent>
    </DialogRootContext>
  );
}

/**
 * Renders the root children inside the dialog context. Render-prop children are invoked
 * once and receive `payload` as a getter, so reading it inside JSX updates the content in
 * place instead of recreating the dialog subtree (which would restart its transitions).
 */
function DialogRootContent<Payload>(props: {
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

export interface DialogRootState {}

export interface DialogRootProps<Payload = unknown> {
  /**
   * Whether the dialog is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the dialog is initially open.
   *
   * To render a controlled dialog, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Determines if the dialog enters a modal state when open.
   * - `true`: user interaction is limited to just the dialog: focus is trapped, document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the dialog, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   *
   * When `modal` is `true` or `'trap-focus'`, render `<Dialog.Close>` inside `<Dialog.Popup>` so
   * touch screen readers can escape the popup.
   * @default true
   */
  modal?: boolean | "trap-focus" | undefined;
  /**
   * Event handler called when the dialog is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: DialogRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the dialog is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether to prevent the dialog from closing on outside presses.
   * For non-modal dialogs, this also prevents the dialog from closing when focus moves outside of it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /**
   * A signal setter that receives the imperative actions.
   * - `unmount`: Manually unmounts the dialog.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the dialog imperatively when called.
   */
  actionsRef?: Setter<DialogRoot.Actions | null> | undefined;
  /**
   * A handle to associate the dialog with a trigger.
   * If specified, allows external triggers to control the dialog's open state.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * The content of the dialog.
   * This can be a regular node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  /**
   * ID of the trigger that the dialog is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled dialog.
   * There's no need to specify this prop when the dialog is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
}

export interface DialogRootActions {
  unmount: () => void;
  close: () => void;
}

export type DialogRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type DialogRootChangeEventDetails = RebaseUIChangeEventDetails<
  DialogRootChangeEventReason,
  {
    preventUnmountOnClose(): void;
  }
>;

export namespace DialogRoot {
  export type State = DialogRootState;
  export type Props<Payload = unknown> = DialogRootProps<Payload>;
  export type Actions = DialogRootActions;
  export type ChangeEventReason = DialogRootChangeEventReason;
  export type ChangeEventDetails = DialogRootChangeEventDetails;
}

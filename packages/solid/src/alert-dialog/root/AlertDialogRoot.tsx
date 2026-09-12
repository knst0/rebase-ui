import type { JSX } from "@solidjs/web";
import { onSettled, type Setter, untrack } from "solid-js";

import { createDialogRoot } from "../../dialog/root/createDialogRoot";
import type { DialogRoot } from "../../dialog/root/DialogRoot";
import { DialogRootContext, useDialogRootContext } from "../../dialog/root/DialogRootContext";
import type { RebaseUIChangeEventDetails } from "../../internals/event-details";
import { stableCallback } from "../../internals/stableCallback";
import type { AlertDialogHandle } from "../handle";

/**
 * Groups all parts of the alert dialog.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Alert Dialog](https://rebase-ui.knst.dev/components/alert-dialog)
 */
export function AlertDialogRoot<Payload = unknown>(props: AlertDialogRoot.Props<Payload>) {
  const parentContext = useDialogRootContext(true);

  const onOpenChange = stableCallback(() => props.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => props.onOpenChangeComplete);

  const dialog = createDialogRoot({
    defaultOpen: () => props.defaultOpen ?? false,
    disablePointerDismissal: () => true,
    modal: () => true,
    onOpenChange,
    onOpenChangeComplete,
    open: () => props.open,
    parentContext: parentContext ?? undefined,
    role: "alertdialog",
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

  return (
    <DialogRootContext value={dialog}>
      <AlertDialogRootContent payload={dialog.payload as () => Payload | undefined}>{props.children}</AlertDialogRootContent>
    </DialogRootContext>
  );
}

/**
 * Renders the root children inside the dialog context. Reads them once so parts keep
 * stable DOM nodes; only the payload of render-prop children stays reactive.
 */
function AlertDialogRootContent<Payload>(props: {
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

export interface AlertDialogRootState {}

export interface AlertDialogRootProps<Payload = unknown> extends Omit<
  DialogRoot.Props<Payload>,
  "modal" | "disablePointerDismissal" | "onOpenChange" | "actionsRef" | "handle"
> {
  /**
   * Event handler called when the alert dialog is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: AlertDialogRoot.ChangeEventDetails) => void) | undefined;
  /**
   * A signal setter that receives the imperative actions.
   * - `unmount`: Manually unmounts the alert dialog.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the alert dialog imperatively when called.
   */
  actionsRef?: Setter<AlertDialogRoot.Actions | null> | undefined;
  /**
   * A handle to associate the alert dialog with a trigger.
   * If specified, allows external triggers to control the alert dialog's open state.
   * Can be created with the AlertDialog.createHandle() method.
   */
  handle?: AlertDialogHandle<Payload> | undefined;
}

export type AlertDialogRootActions = DialogRoot.Actions;

export type AlertDialogRootChangeEventReason = DialogRoot.ChangeEventReason;
export type AlertDialogRootChangeEventDetails = RebaseUIChangeEventDetails<
  AlertDialogRoot.ChangeEventReason,
  {
    preventUnmountOnClose(): void;
  }
>;

export namespace AlertDialogRoot {
  export type State = AlertDialogRootState;
  export type Props<Payload = unknown> = AlertDialogRootProps<Payload>;
  export type Actions = AlertDialogRootActions;
  export type ChangeEventReason = AlertDialogRootChangeEventReason;
  export type ChangeEventDetails = AlertDialogRootChangeEventDetails;
}

import { effect, onCleanup } from "reze-js";

import { createDialogRoot } from "../../dialog/root/createDialogRoot";
import {
  DialogRootContent,
  type DialogRootActions,
  type DialogRootChangeEventReason,
  type DialogRootProps,
} from "../../dialog/root/DialogRoot";
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

  const handle = props.handle;
  if (handle) {
    effect(() => {
      dialog.attachHandle(handle);

      onCleanup(() => {
        dialog.detachHandle(handle);
      });
    });
  }

  const actionsRef = props.actionsRef;
  if (actionsRef) {
    effect(() => {
      actionsRef({
        unmount: dialog.forceUnmount,
        close: dialog.requestClose,
      });

      onCleanup(() => {
        actionsRef(null);
      });
    });
  }

  return (
    <DialogRootContext value={dialog}>
      <DialogRootContent payload={dialog.payload as () => Payload | undefined}>{props.children}</DialogRootContent>
    </DialogRootContext>
  );
}

export interface AlertDialogRootState {}

export interface AlertDialogRootProps<Payload = unknown> extends Omit<
  DialogRootProps<Payload>,
  "modal" | "disablePointerDismissal" | "onOpenChange" | "actionsRef" | "handle"
> {
  /**
   * Event handler called when the alert dialog is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: AlertDialogRoot.ChangeEventDetails) => void) | undefined;
  /**
   * A callback that receives the imperative actions.
   * - `unmount`: Manually unmounts the alert dialog.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the alert dialog imperatively when called.
   */
  actionsRef?: ((actions: AlertDialogRoot.Actions | null) => void) | undefined;
  /**
   * A handle to associate the alert dialog with a trigger.
   * If specified, allows external triggers to control the alert dialog's open state.
   * Can be created with the AlertDialog.createHandle() method.
   */
  handle?: AlertDialogHandle<Payload> | undefined;
}

export type AlertDialogRootActions = DialogRootActions;

export type AlertDialogRootChangeEventReason = DialogRootChangeEventReason;

export type AlertDialogRootChangeEventDetails = RebaseUIChangeEventDetails<
  AlertDialogRootChangeEventReason,
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

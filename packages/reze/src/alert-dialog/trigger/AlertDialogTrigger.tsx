import type { JSX } from "reze-js";

import { DialogTrigger, type DialogTriggerOwnProps, type DialogTriggerState } from "../../dialog/trigger/DialogTrigger";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import type { AlertDialogHandle } from "../handle";

/**
 * A button that opens the alert dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Alert Dialog](https://rebase-ui.knst.dev/components/alert-dialog)
 */
export const AlertDialogTrigger = DialogTrigger as AlertDialogTrigger;

export interface AlertDialogTrigger {
  <Payload = unknown, T extends JSX.ElementType = "button">(props: AlertDialogTriggerProps<Payload, T>): JSX.Element;
}

export interface AlertDialogTriggerOwnProps<Payload = unknown> extends Omit<DialogTriggerOwnProps<Payload>, "handle"> {
  /**
   * A handle to associate the trigger with an alert dialog.
   * Can be created with the AlertDialog.createHandle() method.
   */
  handle?: AlertDialogHandle<Payload> | undefined;
}

export type AlertDialogTriggerProps<Payload = unknown, T extends JSX.ElementType = "button"> = AlertDialogTriggerOwnProps<Payload> &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, AlertDialogTriggerState>;

export interface AlertDialogTriggerState extends DialogTriggerState {}

export namespace AlertDialogTrigger {
  export type State = AlertDialogTriggerState;
  export type Props<Payload = unknown, T extends JSX.ElementType = "button"> = AlertDialogTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = AlertDialogTriggerOwnProps<Payload>;
}

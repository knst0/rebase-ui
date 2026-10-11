import type { JSX } from "reze-js";

import { DialogTrigger, type DialogTriggerOwnProps, type DialogTriggerState } from "../../dialog/trigger/DialogTrigger";
import type { ButtonEventHandlers } from "../../internals/types";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { DrawerHandle } from "../handle";

/**
 * A button that opens the drawer.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export const DrawerTrigger = DialogTrigger as DrawerTrigger;

export interface DrawerTrigger {
  <Payload = unknown, T extends JSX.ElementType = "button">(props: DrawerTriggerProps<Payload, T>): JSX.Element;
}

export interface DrawerTriggerOwnProps<Payload = unknown> extends Omit<DialogTriggerOwnProps<Payload>, "handle"> {
  /**
   * A handle to associate the trigger with a drawer.
   * Can be created with the Drawer.createHandle() method.
   */
  handle?: DrawerHandle<Payload> | undefined;
}

export type DrawerTriggerProps<Payload = unknown, T extends JSX.ElementType = "button"> = DrawerTriggerOwnProps<Payload> &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, DrawerTriggerState>;

export interface DrawerTriggerState extends DialogTriggerState {}

export namespace DrawerTrigger {
  export type State = DrawerTriggerState;
  export type Props<Payload = unknown, T extends JSX.ElementType = "button"> = DrawerTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = DrawerTriggerOwnProps<Payload>;
}

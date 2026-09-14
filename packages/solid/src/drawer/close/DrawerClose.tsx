import type { JSX, ValidComponent } from "@solidjs/web";

import { DialogClose, type DialogCloseOwnProps, type DialogCloseState } from "../../dialog/close/DialogClose";
import type { RebaseUIComponentProps } from "../../internals/types";

/**
 * A button that closes the drawer.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export const DrawerClose = DialogClose as DrawerClose;

export interface DrawerClose {
  <T extends ValidComponent = "button">(props: DrawerCloseProps<T>): JSX.Element;
}

export type DrawerCloseProps<T extends ValidComponent = "button"> = DialogCloseOwnProps & RebaseUIComponentProps<T, DrawerCloseState>;

export interface DrawerCloseState extends DialogCloseState {}

export namespace DrawerClose {
  export type State = DrawerCloseState;
  export type Props<T extends ValidComponent = "button"> = DrawerCloseProps<T>;
  export type OwnProps = DialogCloseOwnProps;
}

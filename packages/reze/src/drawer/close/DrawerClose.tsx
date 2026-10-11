import type { JSX } from "reze-js";

import { DialogClose, type DialogCloseOwnProps, type DialogCloseState } from "../../dialog/close/DialogClose";
import type { ButtonEventHandlers } from "../../internals/types";
import type { RebaseUIComponentProps } from "../../internals/types";

/**
 * A button that closes the drawer.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export const DrawerClose = DialogClose as DrawerClose;

export interface DrawerClose {
  <T extends JSX.ElementType = "button">(props: DrawerCloseProps<T>): JSX.Element;
}

export type DrawerCloseProps<T extends JSX.ElementType = "button"> = DialogCloseOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, DrawerCloseState>;

export interface DrawerCloseState extends DialogCloseState {}

export namespace DrawerClose {
  export type State = DrawerCloseState;
  export type Props<T extends JSX.ElementType = "button"> = DrawerCloseProps<T>;
  export type OwnProps = DialogCloseOwnProps;
}

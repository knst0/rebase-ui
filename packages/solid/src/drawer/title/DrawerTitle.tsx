import type { JSX, ValidComponent } from "@solidjs/web";

import { DialogTitle, type DialogTitleOwnProps, type DialogTitleState } from "../../dialog/title/DialogTitle";
import type { RebaseUIComponentProps } from "../../internals/types";

/**
 * A heading that labels the drawer.
 * Renders an `<h2>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export const DrawerTitle = DialogTitle as DrawerTitle;

export interface DrawerTitle {
  <T extends ValidComponent = "h2">(props: DrawerTitleProps<T>): JSX.Element;
}

export type DrawerTitleProps<T extends ValidComponent = "h2"> = DialogTitleOwnProps & RebaseUIComponentProps<T, DrawerTitleState>;

export interface DrawerTitleState extends DialogTitleState {}

export namespace DrawerTitle {
  export type State = DrawerTitleState;
  export type Props<T extends ValidComponent = "h2"> = DrawerTitleProps<T>;
  export type OwnProps = DialogTitleOwnProps;
}

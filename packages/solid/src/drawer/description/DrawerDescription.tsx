import type { JSX, ValidComponent } from "@solidjs/web";

import { DialogDescription, type DialogDescriptionOwnProps, type DialogDescriptionState } from "../../dialog/description/DialogDescription";
import type { RebaseUIComponentProps } from "../../internals/types";

/**
 * A paragraph with additional information about the drawer.
 * Renders a `<p>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export const DrawerDescription = DialogDescription as DrawerDescription;

export interface DrawerDescription {
  <T extends ValidComponent = "p">(props: DrawerDescriptionProps<T>): JSX.Element;
}

export type DrawerDescriptionProps<T extends ValidComponent = "p"> = DialogDescriptionOwnProps &
  RebaseUIComponentProps<T, DrawerDescriptionState>;

export interface DrawerDescriptionState extends DialogDescriptionState {}

export namespace DrawerDescription {
  export type State = DrawerDescriptionState;
  export type Props<T extends ValidComponent = "p"> = DrawerDescriptionProps<T>;
  export type OwnProps = DialogDescriptionOwnProps;
}

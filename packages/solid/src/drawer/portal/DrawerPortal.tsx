import type { JSX, ValidComponent } from "@solidjs/web";

import { DialogPortal, type DialogPortalOwnProps, type DialogPortalState } from "../../dialog/portal/DialogPortal";
import type { RebaseUIComponentProps } from "../../internals/types";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export const DrawerPortal = DialogPortal as DrawerPortal;

export interface DrawerPortal {
  <T extends ValidComponent = "div">(props: DrawerPortalProps<T>): JSX.Element | null;
}

export type DrawerPortalProps<T extends ValidComponent = "div"> = DialogPortalOwnProps & RebaseUIComponentProps<T, DrawerPortalState>;

export interface DrawerPortalState extends DialogPortalState {}

export namespace DrawerPortal {
  export type State = DrawerPortalState;
  export type Props<T extends ValidComponent = "div"> = DrawerPortalProps<T>;
  export type OwnProps = DialogPortalOwnProps;
}

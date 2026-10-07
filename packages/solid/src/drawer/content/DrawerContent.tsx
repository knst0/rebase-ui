import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { DRAWER_CONTENT_ATTRIBUTE } from "./drawerContentAttribute";

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerContent<T extends ValidComponent = "div">(props: DrawerContent.Props<T>) {
  const [local, elementProps] = split(props as DrawerContent.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  useDialogRootContext();

  const contentProps = {
    [DRAWER_CONTENT_ATTRIBUTE as string]: "",
  };

  return <RenderElement as={as} props={[contentProps, elementProps]} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<DrawerContent.Props>);

export interface DrawerContentState {}

export interface DrawerContentOwnProps {}

export type DrawerContentProps<T extends ValidComponent = "div"> = DrawerContentOwnProps & RebaseUIComponentProps<T, DrawerContentState>;

export namespace DrawerContent {
  export type State = DrawerContentState;
  export type Props<T extends ValidComponent = "div"> = DrawerContentProps<T>;
  export type OwnProps = DrawerContentOwnProps;
}

import { dynamicElement, omitProps, type JSX } from "reze-js";

import { useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { DRAWER_CONTENT_ATTRIBUTE } from "./drawerContentAttribute";

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerContent<T extends JSX.ElementType = "div">(props: DrawerContent.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  useDialogRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      {...{ [DRAWER_CONTENT_ATTRIBUTE]: "" }}
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

export interface DrawerContentState {}

export interface DrawerContentOwnProps {}

export type DrawerContentProps<T extends JSX.ElementType = "div"> = DrawerContentOwnProps & RebaseUIComponentProps<T, DrawerContentState>;

export namespace DrawerContent {
  export type State = DrawerContentState;
  export type Props<T extends JSX.ElementType = "div"> = DrawerContentProps<T>;
  export type OwnProps = DrawerContentOwnProps;
}

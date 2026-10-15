import { dynamicElement, omitProps, type JSX } from "reze-js";

import { useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import * as DrawerPopupCssVars from "../popup/DrawerPopupCssVars";
import * as DrawerBackdropCssVars from "./DrawerBackdropCssVars";

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerBackdrop<T extends JSX.ElementType = "div">(props: DrawerBackdrop.Props<T>) {
  const rest = omitProps(props, "as", "forceRender", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const forceRender = props.forceRender ?? false;

  const dialog = useDialogRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <>
      {(forceRender || !dialog.nested) && (
        <Tag
          {...(rest as Record<string, unknown>)}
          role="presentation"
          hidden={dialog.mounted() ? undefined : true}
          ref={mergeRefs(
            (element: HTMLElement | null) => {
              dialog.setBackdropElement(element as HTMLDivElement | null);
            },
            props.ref as ((element: HTMLElement | null) => void) | undefined,
          )}
          data-open={dialog.open() ? "" : undefined}
          data-closed={dialog.open() ? undefined : ""}
          data-starting-style={dialog.transitionStatus() === "starting" ? "" : undefined}
          data-ending-style={dialog.transitionStatus() === "ending" ? "" : undefined}
          class={resolveClassValue(props.class, { open: dialog.open(), transitionStatus: dialog.transitionStatus() })}
          style={mergeStyleValue(
            {
              "pointer-events": !dialog.open() ? "none" : undefined,
              "user-select": "none",
              "-webkit-user-select": "none",
              [DrawerBackdropCssVars.swipeProgress]: "0",
              [DrawerPopupCssVars.swipeStrength]: "1",
            },
            resolveStyleValue(props.style, { open: dialog.open(), transitionStatus: dialog.transitionStatus() }),
          )}
        >
          {resolveChildrenValue(children, () => ({ open: dialog.open(), transitionStatus: dialog.transitionStatus() }))}
        </Tag>
      )}
    </>
  );
}

export interface DrawerBackdropState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface DrawerBackdropOwnProps {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export type DrawerBackdropProps<T extends JSX.ElementType = "div"> = DrawerBackdropOwnProps &
  RebaseUIComponentProps<T, DrawerBackdropState>;

export namespace DrawerBackdrop {
  export type State = DrawerBackdropState;
  export type Props<T extends JSX.ElementType = "div"> = DrawerBackdropProps<T>;
  export type OwnProps = DrawerBackdropOwnProps;
}

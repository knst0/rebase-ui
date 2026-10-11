import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogRootContext } from "../root/DialogRootContext";

/**
 * A backdrop that covers the page while the dialog is open.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogBackdrop<T extends JSX.ElementType = "div">(props: DialogBackdrop.Props<T>) {
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
            { "user-select": "none", "-webkit-user-select": "none" },
            resolveStyleValue(props.style, { open: dialog.open(), transitionStatus: dialog.transitionStatus() }),
          )}
        >
          {resolveChildrenValue(children, () => ({ open: dialog.open(), transitionStatus: dialog.transitionStatus() }))}
        </Tag>
      )}
    </>
  );
}

export interface DialogBackdropOwnProps {
  /**
   * Whether the backdrop is rendered even when the dialog is nested inside another dialog.
   * Set this to `true` if your nested dialog has a transparent background to cover the parent dialog content.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export type DialogBackdropProps<T extends JSX.ElementType = "div"> = DialogBackdropOwnProps &
  RebaseUIComponentProps<T, DialogBackdropState>;

export interface DialogBackdropState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  transitionStatus: TransitionStatus;
}

export namespace DialogBackdrop {
  export type State = DialogBackdropState;
  export type Props<T extends JSX.ElementType = "div"> = DialogBackdropProps<T>;
  export type OwnProps = DialogBackdropOwnProps;
}

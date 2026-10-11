import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogPortalContext } from "../portal/DialogPortalContext";
import { useDialogRootContext } from "../root/DialogRootContext";

/**
 * The viewport allows the popup to transition between different content sizes.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogViewport<T extends JSX.ElementType = "div">(props: DialogViewport.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const dialog = useDialogRootContext();
  const keepMounted = useDialogPortalContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <>
      {(keepMounted || dialog.mounted()) && (
        <Tag
          {...(rest as Record<string, unknown>)}
          role="presentation"
          hidden={dialog.open() || (dialog.mounted() && !dialog.closeSettled()) ? undefined : true}
          ref={mergeRefs(
            (element: HTMLElement | null) => {
              dialog.setViewportElement(element as HTMLDivElement | null);
            },
            props.ref as ((element: HTMLElement | null) => void) | undefined,
          )}
          data-open={dialog.open() ? "" : undefined}
          data-closed={dialog.open() ? undefined : ""}
          data-starting-style={dialog.transitionStatus() === "starting" ? "" : undefined}
          data-ending-style={dialog.transitionStatus() === "ending" ? "" : undefined}
          data-nested={dialog.nested ? "" : undefined}
          data-nested-dialog-open={dialog.nestedOpenDialogCount() > 0 ? "" : undefined}
          class={resolveClassValue(props.class, {
            open: dialog.open(),
            transitionStatus: dialog.transitionStatus(),
            nested: dialog.nested,
            nestedDialogOpen: dialog.nestedOpenDialogCount() > 0,
          })}
          style={mergeStyleValue(
            { "pointer-events": dialog.open() ? undefined : "none" },
            resolveStyleValue(props.style, {
              open: dialog.open(),
              transitionStatus: dialog.transitionStatus(),
              nested: dialog.nested,
              nestedDialogOpen: dialog.nestedOpenDialogCount() > 0,
            }),
          )}
        >
          {resolveChildrenValue(children, () => ({
            open: dialog.open(),
            transitionStatus: dialog.transitionStatus(),
            nested: dialog.nested,
            nestedDialogOpen: dialog.nestedOpenDialogCount() > 0,
          }))}
        </Tag>
      )}
    </>
  );
}

export type DialogViewportProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, DialogViewportState>;

export interface DialogViewportState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  transitionStatus: TransitionStatus;
  /**
   * Whether the dialog is nested inside another dialog.
   */
  nested: boolean;
  /**
   * Whether a nested dialog is currently open.
   */
  nestedDialogOpen: boolean;
}

export namespace DialogViewport {
  export type State = DialogViewportState;
  export type Props<T extends JSX.ElementType = "div"> = DialogViewportProps<T>;
}

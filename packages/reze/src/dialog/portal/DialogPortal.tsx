import { dynamicElement, omitProps, Portal, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogRootContext } from "../root/DialogRootContext";
import { DialogPortalContext } from "./DialogPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogPortal<T extends JSX.ElementType = "div">(props: DialogPortal.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "container", "class", "style", "children", "ref");
  // Deliberately not hoisted: portal children must be created inside the portal
  // context provider (and the mounted branch) below, not in this body. The state
  // is static so resolving here cannot poison the branch with dialog state reads.

  const keepMounted = props.keepMounted ?? false;
  const container = props.container ?? (typeof document === "undefined" ? undefined : document.body);

  const dialog = useDialogRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <>
      {(keepMounted || dialog.mounted()) && (
        <DialogPortalContext value={keepMounted}>
          <Portal mount={container}>
            {dialog.mounted() && dialog.modal() === true && (
              <div
                ref={(element) => {
                  dialog.setInternalBackdropElement(element);
                }}
                inert={!dialog.open()}
              />
            )}
            <Tag
              {...(rest as Record<string, unknown>)}
              class={resolveClassValue(props.class, {})}
              style={resolveStyleValue(props.style, {})}
              ref={props.ref}
            >
              {resolveChildrenValue(props.children, () => ({}))}
            </Tag>
          </Portal>
        </DialogPortalContext>
      )}
    </>
  );
}

export interface DialogPortalOwnProps {
  /**
   * Whether to keep the element in the DOM while the dialog is closed.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   * @default document.body
   */
  container?: HTMLElement | ShadowRoot | undefined;
}

export type DialogPortalProps<T extends JSX.ElementType = "div"> = DialogPortalOwnProps & RebaseUIComponentProps<T, DialogPortalState>;

export interface DialogPortalState {}

export namespace DialogPortal {
  export type State = DialogPortalState;
  export type Props<T extends JSX.ElementType = "div"> = DialogPortalProps<T>;
  export type OwnProps = DialogPortalOwnProps;
}

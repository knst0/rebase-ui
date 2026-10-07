import { Portal, type ValidComponent } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogRootContext } from "../root/DialogRootContext";
import { DialogPortalContext } from "./DialogPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogPortal<T extends ValidComponent = "div">(props: DialogPortal.Props<T>) {
  const [local, elementProps] = split(props as DialogPortal.Props, { default: defaultProps }, ["as", "keepMounted", "container"]);

  const as = untrack(() => local.as);
  const keepMounted = untrack(() => local.keepMounted);
  const container = untrack(() => local.container) ?? (typeof document !== "undefined" ? document.body : undefined);

  const store = useDialogRootContext();

  const shouldRender = () => keepMounted || store.mounted();

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref),
  });

  return (
    <Show when={shouldRender()}>
      <DialogPortalContext value={keepMounted}>
        <Portal mount={container as Element | undefined}>
          <Show when={store.mounted() && store.modal() === true}>
            <div ref={store.setInternalBackdropElement} inert={!store.open()} />
          </Show>
          <RenderElement as={as} props={[elementProps, refProps]} />
        </Portal>
      </DialogPortalContext>
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<DialogPortal.Props>);

export interface DialogPortalState {}

export interface DialogPortalOwnProps {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | undefined;
}

export type DialogPortalProps<T extends ValidComponent = "div"> = DialogPortalOwnProps & RebaseUIComponentProps<T, DialogPortalState>;

export namespace DialogPortal {
  export type State = DialogPortalState;
  export type Props<T extends ValidComponent = "div"> = DialogPortalProps<T>;
  export type OwnProps = DialogPortalOwnProps;
}

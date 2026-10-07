import { Portal, type ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";

/**
 * A portal element that moves the viewport to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastPortal<T extends ValidComponent = "div">(props: ToastPortal.Props<T>) {
  const [local, elementProps] = split(props as ToastPortal.Props, { default: defaultProps }, ["as", "container"]);

  const as = untrack(() => local.as);
  const container = untrack(() => local.container) ?? (typeof document !== "undefined" ? document.body : undefined);

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref),
  });

  return (
    <Portal mount={container as Element | undefined}>
      <RenderElement as={as} props={[elementProps, refProps]} />
    </Portal>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ToastPortal.Props>);

export interface ToastPortalState {}

export interface ToastPortalOwnProps {
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | undefined;
}

export type ToastPortalProps<T extends ValidComponent = "div"> = ToastPortalOwnProps & RebaseUIComponentProps<T, ToastPortalState>;

export namespace ToastPortal {
  export type State = ToastPortalState;
  export type Props<T extends ValidComponent = "div"> = ToastPortalProps<T>;
  export type OwnProps = ToastPortalOwnProps;
}

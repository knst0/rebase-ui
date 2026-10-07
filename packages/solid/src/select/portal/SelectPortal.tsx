import { Portal, type ValidComponent } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Select](https://rebase-ui.knst.dev/components/select)
 */
export function SelectPortal<T extends ValidComponent = "div">(props: SelectPortal.Props<T>) {
  const [local, elementProps] = split(props as SelectPortal.Props, { default: defaultProps }, ["as", "container"]);

  const as = untrack(() => local.as);
  const container = untrack(() => local.container) ?? (typeof document !== "undefined" ? document.body : undefined);

  const store = useSelectRootContext();

  const shouldRender = () => store.select("mounted") || store.select("forceMount");

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref),
  });

  return (
    <Show when={shouldRender()}>
      <Portal mount={container as Element | undefined}>
        <RenderElement as={as} props={[elementProps, refProps]} />
      </Portal>
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SelectPortal.Props>);

export interface SelectPortalState {}

export interface SelectPortalOwnProps {
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | { current: HTMLElement | ShadowRoot | null } | null | undefined;
}

export type SelectPortalProps<T extends ValidComponent = "div"> = SelectPortalOwnProps & RebaseUIComponentProps<T, SelectPortalState>;

export namespace SelectPortal {
  export type State = SelectPortalState;
  export type Props<T extends ValidComponent = "div"> = SelectPortalProps<T>;
  export type OwnProps = SelectPortalOwnProps;
}

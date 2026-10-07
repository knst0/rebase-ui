import { Portal, type ValidComponent } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useTooltipRootContext } from "../root/TooltipRootContext";
import { TooltipPortalContext } from "./TooltipPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipPortal<T extends ValidComponent = "div">(props: TooltipPortal.Props<T>) {
  const [local, elementProps] = split(props as TooltipPortal.Props, { default: defaultProps }, ["as", "keepMounted", "container"]);

  const as = untrack(() => local.as);
  const keepMounted = untrack(() => local.keepMounted);
  const container = untrack(() => local.container) ?? (typeof document !== "undefined" ? document.body : undefined);

  const store = useTooltipRootContext();

  const shouldRender = () => keepMounted || store.select("mounted");

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref),
  });

  return (
    <Show when={shouldRender()}>
      <TooltipPortalContext value={keepMounted}>
        <Portal mount={container as Element | undefined}>
          <RenderElement as={as} props={[elementProps, refProps]} />
        </Portal>
      </TooltipPortalContext>
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<TooltipPortal.Props>);

export interface TooltipPortalState {}

export interface TooltipPortalOwnProps {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | { current: HTMLElement | ShadowRoot | null } | null | undefined;
}

export type TooltipPortalProps<T extends ValidComponent = "div"> = TooltipPortalOwnProps & RebaseUIComponentProps<T, TooltipPortalState>;

export namespace TooltipPortal {
  export type State = TooltipPortalState;
  export type Props<T extends ValidComponent = "div"> = TooltipPortalProps<T>;
  export type OwnProps = TooltipPortalOwnProps;
}

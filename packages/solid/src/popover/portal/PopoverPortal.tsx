import { Portal, type ValidComponent } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import { PopoverPortalContext } from "./PopoverPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverPortal<T extends ValidComponent = "div">(props: PopoverPortal.Props<T>) {
  const [local, elementProps] = split(props as PopoverPortal.Props, { default: defaultProps }, ["as", "keepMounted", "container"]);

  const as = untrack(() => local.as);
  const keepMounted = untrack(() => local.keepMounted);
  const container = untrack(() => local.container) ?? (typeof document !== "undefined" ? document.body : undefined);

  const store = usePopoverRootContext();

  const shouldRender = () => keepMounted || store.select("mounted");

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref),
  });

  return (
    <Show when={shouldRender()}>
      <PopoverPortalContext value={keepMounted}>
        <Portal mount={container as Element | undefined}>
          <RenderElement as={as} props={[elementProps, refProps]} />
        </Portal>
      </PopoverPortalContext>
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<PopoverPortal.Props>);

export interface PopoverPortalState {}

export interface PopoverPortalOwnProps {
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

export type PopoverPortalProps<T extends ValidComponent = "div"> = PopoverPortalOwnProps & RebaseUIComponentProps<T, PopoverPortalState>;

export namespace PopoverPortal {
  export type State = PopoverPortalState;
  export type Props<T extends ValidComponent = "div"> = PopoverPortalProps<T>;
  export type OwnProps = PopoverPortalOwnProps;
}

import { Portal, type ValidComponent } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuRootContext } from "../root/MenuRootContext";
import { MenuPortalContext } from "./MenuPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuPortal<T extends ValidComponent = "div">(props: MenuPortal.Props<T>) {
  const [local, elementProps] = split(props as MenuPortal.Props, { default: defaultProps }, ["as", "keepMounted", "container"]);

  const as = untrack(() => local.as);
  const keepMounted = untrack(() => local.keepMounted);
  const container = untrack(() => local.container) ?? (typeof document !== "undefined" ? document.body : undefined);

  const { store } = useMenuRootContext();

  const shouldRender = () => keepMounted || store.select("mounted");

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref),
  });

  return (
    <Show when={shouldRender()}>
      <MenuPortalContext value={keepMounted}>
        <Portal mount={container as Element | undefined}>
          <RenderElement as={as} props={[elementProps, refProps]} untrackChildren />
        </Portal>
      </MenuPortalContext>
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<MenuPortal.Props>);

export interface MenuPortalState {}

export interface MenuPortalOwnProps {
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

export type MenuPortalProps<T extends ValidComponent = "div"> = MenuPortalOwnProps & RebaseUIComponentProps<T, MenuPortalState>;

export namespace MenuPortal {
  export type State = MenuPortalState;
  export type Props<T extends ValidComponent = "div"> = MenuPortalProps<T>;
  export type OwnProps = MenuPortalOwnProps;
}

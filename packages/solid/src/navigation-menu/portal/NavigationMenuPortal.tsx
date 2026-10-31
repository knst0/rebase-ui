import { Portal, type ValidComponent } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";
import { NavigationMenuPortalContext } from "./NavigationMenuPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuPortal<T extends ValidComponent = "div">(props: NavigationMenuPortal.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuPortal.Props, { default: defaultProps }, ["as", "keepMounted", "container"]);

  const as = untrack(() => local.as);
  const keepMounted = untrack(() => local.keepMounted) as boolean;
  const container = untrack(() => local.container) ?? (typeof document !== "undefined" ? document.body : undefined);

  const { mounted } = useNavigationMenuRootContext();

  return (
    <Show when={keepMounted || mounted()}>
      <NavigationMenuPortalContext value={keepMounted}>
        <Portal mount={container as Element | undefined}>
          <RenderElement as={as} props={[elementProps]} untrackChildren />
        </Portal>
      </NavigationMenuPortalContext>
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<NavigationMenuPortal.Props>);

export interface NavigationMenuPortalState {}

export interface NavigationMenuPortalOwnProps {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | null | undefined;
}

export type NavigationMenuPortalProps<T extends ValidComponent = "div"> = NavigationMenuPortalOwnProps &
  RebaseUIComponentProps<T, NavigationMenuPortalState>;

export namespace NavigationMenuPortal {
  export type State = NavigationMenuPortalState;
  export type Props<T extends ValidComponent = "div"> = NavigationMenuPortalProps<T>;
}

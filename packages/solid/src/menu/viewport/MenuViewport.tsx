import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { createPopupViewport } from "../../internals/popups/popupViewport";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuPositionerContext } from "../positioner/MenuPositionerContext";
import { useMenuRootContext } from "../root/MenuRootContext";
import { menuViewportStateMapping } from "../utils/stateAttributesMapping";

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuViewport<T extends ValidComponent = "div">(props: MenuViewport.Props<T>) {
  const [local, elementProps] = split(props as MenuViewport.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { store } = useMenuRootContext();
  const positioner = useMenuPositionerContext();

  const state: MenuViewportState = {
    get activationDirection() {
      return viewport.state.activationDirection;
    },
    get transitioning() {
      return viewport.state.transitioning;
    },
    get instant() {
      return store.select("instantType");
    },
  };

  const viewport = createPopupViewport({
    store,
    side: positioner.side,
    // Read on every render pass so a payload change updates the content in place.
    children: () => {
      const value = elementProps.children as JSX.Element | ((state: MenuViewportState) => JSX.Element);
      return typeof value === "function" ? value(state) : value;
    },
  });

  const childrenProps = {
    get children() {
      return viewport.children();
    },
  };

  return <RenderElement as={as} state={state} props={[elementProps, childrenProps]} stateAttributesMapping={menuViewportStateMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<MenuViewport.Props>);

export interface MenuViewportState {
  /**
   * The activation direction of the transitioned content.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
  /**
   * Present if animations should be instant.
   */
  instant: "dismiss" | "click" | "group" | "trigger-change" | undefined;
}

export interface MenuViewportOwnProps {
  /**
   * The content to render inside the transition container.
   */
  children?: JSX.Element | undefined;
}

export type MenuViewportProps<T extends ValidComponent = "div"> = MenuViewportOwnProps & RebaseUIComponentProps<T, MenuViewportState>;

export namespace MenuViewport {
  export type State = MenuViewportState;
  export type Props<T extends ValidComponent = "div"> = MenuViewportProps<T>;
  export type OwnProps = MenuViewportOwnProps;
}

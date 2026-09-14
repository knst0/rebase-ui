import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { REASONS } from "../../internals/event-details";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuRootContext } from "../root/MenuRootContext";
import { menuPopupStateMapping } from "../utils/stateAttributesMapping";

/**
 * An overlay displayed beneath the menu popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuBackdrop<T extends ValidComponent = "div">(props: MenuBackdrop.Props<T>) {
  const [local, elementProps] = split(props as MenuBackdrop.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { store } = useMenuRootContext();

  const state: MenuBackdropState = {
    get open() {
      return store.select("open");
    },
    get transitionStatus() {
      return store.select("transitionStatus");
    },
  };

  const backdropProps = {
    role: "presentation" as const,
    get hidden() {
      return !store.select("mounted") || undefined;
    },
    get style() {
      return {
        "pointer-events": (store.select("lastOpenChangeReason") as string | null) === REASONS.triggerHover ? ("none" as const) : undefined,
        "user-select": "none" as const,
        "-webkit-user-select": "none" as const,
      };
    },
  };

  return <RenderElement as={as} state={state} stateAttributesMapping={menuPopupStateMapping} props={[backdropProps, elementProps]} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<MenuBackdrop.Props>);

export interface MenuBackdropState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type MenuBackdropProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, MenuBackdropState>;

export namespace MenuBackdrop {
  export type State = MenuBackdropState;
  export type Props<T extends ValidComponent = "div"> = MenuBackdropProps<T>;
}

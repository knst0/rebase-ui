import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuPositionerContext } from "../positioner/MenuPositionerContext";
import { useMenuRootContext } from "../root/MenuRootContext";
import { menuArrowStateMapping } from "../utils/stateAttributesMapping";

/**
 * Displays an element positioned against the menu anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuArrow<T extends ValidComponent = "div">(props: MenuArrow.Props<T>) {
  const [local, elementProps] = split(props as MenuArrow.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { store } = useMenuRootContext();
  const positioner = useMenuPositionerContext();

  const state: MenuArrowState = {
    get open() {
      return store.select("open");
    },
    get side() {
      return positioner.side();
    },
    get align() {
      return positioner.align();
    },
    get uncentered() {
      return positioner.arrowUncentered();
    },
  };

  const arrowStyles = () => positioner.arrowStyles() as Record<string, string>;

  const arrowProps = {
    get style() {
      return arrowStyles();
    },
    "aria-hidden": "true" as const,
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<Element>(externalProps.ref, (element: Element | null) => {
      positioner.arrowRef.current = element;
    }),
  });

  return (
    <RenderElement as={as} state={state} stateAttributesMapping={menuArrowStateMapping} props={[arrowProps, elementProps, refProps]} />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<MenuArrow.Props>);

export interface MenuArrowState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export type MenuArrowProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, MenuArrowState>;

export namespace MenuArrow {
  export type State = MenuArrowState;
  export type Props<T extends ValidComponent = "div"> = MenuArrowProps<T>;
}

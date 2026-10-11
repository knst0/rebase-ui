import { dynamicElement, omitProps, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuPositionerContext } from "../positioner/MenuPositionerContext";
import { useMenuRootContext } from "../root/MenuRootContext";

/**
 * Displays an element positioned against the menu anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuArrow<T extends JSX.ElementType = "div">(props: MenuArrow.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { store } = useMenuRootContext();
  const positioner = useMenuPositionerContext();

  function snapshot(): MenuArrowState {
    return {
      open: store.select("open"),
      side: positioner.side(),
      align: positioner.align(),
      uncentered: positioner.arrowUncentered(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function ref(element: HTMLElement | null) {
    positioner.arrowRef.current = element;
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-hidden="true"
      data-open={store.select("open") ? "" : undefined}
      data-closed={store.select("open") ? undefined : ""}
      data-side={positioner.side()}
      data-align={positioner.align()}
      data-uncentered={positioner.arrowUncentered() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(positioner.arrowStyles() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

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

export type MenuArrowProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, MenuArrowState>;

export namespace MenuArrow {
  export type State = MenuArrowState;
  export type Props<T extends JSX.ElementType = "div"> = MenuArrowProps<T>;
}

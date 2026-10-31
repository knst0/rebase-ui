import { dynamicElement, omitProps, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuPositionerContext } from "../positioner/NavigationMenuPositionerContext";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";
import { inPlace } from "../utils/inPlace";

/**
 * Displays an element pointing toward the navigation menu's current anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuArrow<T extends JSX.ElementType = "div">(props: NavigationMenuArrow.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { open } = useNavigationMenuRootContext();
  const positioning = useNavigationMenuPositionerContext();

  function snapshot(): NavigationMenuArrowState {
    return { open: open(), side: positioning.side(), align: positioning.align(), uncentered: positioning.arrowUncentered() };
  }

  const ref = mergeRefs<HTMLElement>(props.ref as ((element: HTMLElement | null) => void) | undefined, (element) => {
    positioning.arrowRef.current = element;
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return inPlace(
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-hidden="true"
      data-open={open() ? "" : undefined}
      data-closed={open() ? undefined : ""}
      data-side={positioning.side()}
      data-align={positioning.align()}
      data-uncentered={positioning.arrowUncentered() ? "" : undefined}
      class={resolveClassValue(props.class as never, snapshot())}
      style={mergeStyleValue(
        positioning.arrowStyles() as Record<string, string | undefined>,
        resolveStyleValue(props.style as never, snapshot()),
      )}
      ref={(element: HTMLElement | null) => ref(element as HTMLElement)}
    >
      {resolveChildrenValue(children as never, snapshot)}
    </Tag>,
  );
}

export interface NavigationMenuArrowState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The side of the anchor the popup is positioned on.
   */
  side: Side;
  /**
   * The alignment of the popup relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export type NavigationMenuArrowProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, NavigationMenuArrowState>;

export namespace NavigationMenuArrow {
  export type State = NavigationMenuArrowState;
  export type Props<T extends JSX.ElementType = "div"> = NavigationMenuArrowProps<T>;
}

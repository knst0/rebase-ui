import { dynamicElement, omitProps, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverPositionerContext } from "../positioner/PopoverPositionerContext";
import { usePopoverRootContext } from "../root/PopoverRootContext";

/**
 * Displays an element positioned against the popover anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverArrow<T extends JSX.ElementType = "div">(props: PopoverArrow.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = usePopoverRootContext();
  const positioner = usePopoverPositionerContext();

  function snapshot(): PopoverArrowState {
    return {
      open: store.select("open"),
      side: positioner.side(),
      align: positioner.align(),
      uncentered: positioner.arrowUncentered(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

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
      ref={mergeRefs(
        (element: Element | null) => {
          positioner.arrowRef.current = element;
        },
        props.ref as ((element: HTMLElement | null) => void) | undefined,
      )}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface PopoverArrowState {
  /**
   * Whether the popover is currently open.
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

export type PopoverArrowProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, PopoverArrowState>;

export namespace PopoverArrow {
  export type State = PopoverArrowState;
  export type Props<T extends JSX.ElementType = "div"> = PopoverArrowProps<T>;
}

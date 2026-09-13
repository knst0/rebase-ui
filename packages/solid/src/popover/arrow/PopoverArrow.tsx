import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverPositionerContext } from "../positioner/PopoverPositionerContext";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import { popoverArrowStateMapping } from "../utils/stateAttributesMapping";

/**
 * Displays an element positioned against the popover anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverArrow<T extends ValidComponent = "div">(props: PopoverArrow.Props<T>) {
  const [local, elementProps] = split(props as PopoverArrow.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = usePopoverRootContext();
  const positioner = usePopoverPositionerContext();

  const state: PopoverArrowState = {
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

  const arrowProps = {
    get style() {
      return positioner.arrowStyles();
    },
    "aria-hidden": "true" as const,
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<Element>(externalProps.ref, (element: Element | null) => {
      positioner.arrowRef.current = element;
    }),
  });

  return (
    <RenderElement as={as} state={state} props={[arrowProps, elementProps, refProps]} stateAttributesMapping={popoverArrowStateMapping} />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<PopoverArrow.Props>);

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

export type PopoverArrowProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, PopoverArrowState>;

export namespace PopoverArrow {
  export type State = PopoverArrowState;
  export type Props<T extends ValidComponent = "div"> = PopoverArrowProps<T>;
}

import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useTooltipPositionerContext } from "../positioner/TooltipPositionerContext";
import { useTooltipRootContext } from "../root/TooltipRootContext";
import { tooltipArrowStateMapping } from "../utils/stateAttributesMapping";

/**
 * Displays an element positioned against the tooltip anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipArrow<T extends ValidComponent = "div">(props: TooltipArrow.Props<T>) {
  const [local, elementProps] = split(props as TooltipArrow.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  const state: TooltipArrowState = {
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
    get instant() {
      return store.select("instantType");
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
    <RenderElement as={as} state={state} props={[arrowProps, elementProps, refProps]} stateAttributesMapping={tooltipArrowStateMapping} />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<TooltipArrow.Props>);

export interface TooltipArrowState {
  /**
   * Whether the tooltip is currently open.
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
  /**
   * Whether transitions should be skipped.
   */
  instant: "delay" | "dismiss" | "focus" | undefined;
}

export type TooltipArrowProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, TooltipArrowState>;

export namespace TooltipArrow {
  export type State = TooltipArrowState;
  export type Props<T extends ValidComponent = "div"> = TooltipArrowProps<T>;
}

import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useToastPositionerContext } from "../positioner/ToastPositionerContext";

/**
 * Displays an element positioned against the toast anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastArrow<T extends ValidComponent = "div">(props: ToastArrow.Props<T>) {
  const [local, elementProps] = split(props as ToastArrow.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { arrowRef, side, align, arrowUncentered, arrowStyles } = useToastPositionerContext();

  const state: ToastArrowState = {
    get side() {
      return side();
    },
    get align() {
      return align();
    },
    get uncentered() {
      return arrowUncentered();
    },
  };

  const arrowProps = {
    get style() {
      return arrowStyles();
    },
    "aria-hidden": "true" as const,
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<Element>(externalProps.ref, (element: Element | null) => {
      arrowRef.current = element;
    }),
  });

  return <RenderElement as={as} state={state} props={[arrowProps, elementProps, refProps]} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ToastArrow.Props>);

export interface ToastArrowState {
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

export type ToastArrowProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ToastArrowState>;

export namespace ToastArrow {
  export type State = ToastArrowState;
  export type Props<T extends ValidComponent = "div"> = ToastArrowProps<T>;
}

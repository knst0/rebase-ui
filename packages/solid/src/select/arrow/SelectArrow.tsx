import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectPositionerContext } from "../positioner/SelectPositionerContext";
import { useSelectRootContext } from "../root/SelectRootContext";
import { selectArrowStateMapping } from "../utils/stateAttributesMapping";

/**
 * Displays an element positioned against the select popup anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Select](https://rebase-ui.knst.dev/components/select)
 */
export function SelectArrow<T extends ValidComponent = "div">(props: SelectArrow.Props<T>) {
  const [local, elementProps] = split(props as SelectArrow.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = useSelectRootContext();
  const positioner = useSelectPositionerContext();

  const state: SelectArrowState = {
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
    <RenderElement
      as={as}
      enabled={() => !positioner.alignItemWithTriggerActive()}
      state={state}
      props={[arrowProps, elementProps, refProps]}
      stateAttributesMapping={selectArrowStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SelectArrow.Props>);

export interface SelectArrowState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | "none";
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export type SelectArrowProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, SelectArrowState>;

export namespace SelectArrow {
  export type State = SelectArrowState;
  export type Props<T extends ValidComponent = "div"> = SelectArrowProps<T>;
}

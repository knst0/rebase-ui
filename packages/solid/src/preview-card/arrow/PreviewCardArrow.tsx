import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardPositionerContext } from "../positioner/PreviewCardPositionerContext";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";
import { previewCardArrowStateMapping } from "../utils/stateAttributesMapping";

/**
 * Displays an element positioned against the preview card anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardArrow<T extends ValidComponent = "div">(props: PreviewCardArrow.Props<T>) {
  const [local, elementProps] = split(props as PreviewCardArrow.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = usePreviewCardRootContext();
  const positioner = usePreviewCardPositionerContext();

  const state: PreviewCardArrowState = {
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
      state={state}
      props={[arrowProps, elementProps, refProps]}
      stateAttributesMapping={previewCardArrowStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<PreviewCardArrow.Props>);

export interface PreviewCardArrowState {
  /**
   * Whether the preview card is currently open.
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

export type PreviewCardArrowProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, PreviewCardArrowState>;

export namespace PreviewCardArrow {
  export type State = PreviewCardArrowState;
  export type Props<T extends ValidComponent = "div"> = PreviewCardArrowProps<T>;
}

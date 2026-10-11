import { dynamicElement, omitProps, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardPositionerContext } from "../positioner/PreviewCardPositionerContext";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";

/**
 * Displays an element positioned against the preview card anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardArrow<T extends JSX.ElementType = "div">(props: PreviewCardArrow.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = usePreviewCardRootContext();
  const positioner = usePreviewCardPositionerContext();

  function snapshot(): PreviewCardArrowState {
    return {
      open: store.select("open") as boolean,
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
      data-open={(store.select("open") as boolean) ? "" : undefined}
      data-closed={(store.select("open") as boolean) ? undefined : ""}
      data-side={positioner.side()}
      data-align={positioner.align()}
      data-uncentered={positioner.arrowUncentered() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(positioner.arrowStyles() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
      ref={mergeRefs(
        (element: Element | null) => {
          positioner.arrowRef.current = element;
        },
        props.ref as ((element: Element | null) => void) | undefined,
      )}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

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

export type PreviewCardArrowProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, PreviewCardArrowState>;

export namespace PreviewCardArrow {
  export type State = PreviewCardArrowState;
  export type Props<T extends JSX.ElementType = "div"> = PreviewCardArrowProps<T>;
}

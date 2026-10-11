import { dynamicElement, omitProps, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useToastPositionerContext } from "../positioner/ToastPositionerContext";

/**
 * Displays an element positioned against the toast anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastArrow<T extends JSX.ElementType = "div">(props: ToastArrow.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { arrowRef, side, align, arrowUncentered, arrowStyles } = useToastPositionerContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function snapshot(): ToastArrowState {
    return { side: side(), align: align(), uncentered: arrowUncentered() };
  }

  const ref = mergeRefs(
    (element: Element | null) => {
      arrowRef.current = element;
    },
    props.ref as ((element: Element | null) => void) | undefined,
  );

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts. The default path renders a static `<div>` so toast
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        aria-hidden="true"
        data-side={side()}
        data-align={align()}
        data-uncentered={arrowUncentered() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue({ ...arrowStyles() } as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-hidden="true"
      data-side={side()}
      data-align={align()}
      data-uncentered={arrowUncentered() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue({ ...arrowStyles() } as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

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

export type ToastArrowProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ToastArrowState>;

export namespace ToastArrow {
  export type State = ToastArrowState;
  export type Props<T extends JSX.ElementType = "div"> = ToastArrowProps<T>;
}

import { dynamicElement, omitProps, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { useTooltipPositionerContext } from "../positioner/TooltipPositionerContext";
import { useTooltipRootContext } from "../root/TooltipRootContext";

/**
 * Displays an element positioned against the tooltip anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipArrow<T extends JSX.ElementType = "div">(props: TooltipArrow.Props<T>) {
  const rest = omitProps(props, "as", "aria-hidden", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  function snapshot(): TooltipArrowState {
    return {
      open: store.select("open") as boolean,
      side: positioner.side(),
      align: positioner.align(),
      uncentered: positioner.arrowUncentered(),
      instant: store.select("instantType"),
    };
  }

  function open(): boolean {
    return store.select("open") as boolean;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const elementRef = mergeRefs(
    (element: Element | null) => {
      positioner.arrowRef.current = element;
    },
    props.ref as ((element: Element | null) => void) | undefined,
  );

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts. The default path renders
  // a static `<div>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        aria-hidden={(props["aria-hidden"] as "true" | undefined) ?? "true"}
        data-open={open() ? "" : undefined}
        data-closed={open() ? undefined : ""}
        data-side={positioner.side()}
        data-align={positioner.align()}
        data-uncentered={positioner.arrowUncentered() ? "" : undefined}
        data-instant={(store.select("instantType") as string | undefined) ?? undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(positioner.arrowStyles() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
        ref={elementRef}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-hidden={(props["aria-hidden"] as "true" | undefined) ?? "true"}
      data-open={open() ? "" : undefined}
      data-closed={open() ? undefined : ""}
      data-side={positioner.side()}
      data-align={positioner.align()}
      data-uncentered={positioner.arrowUncentered() ? "" : undefined}
      data-instant={(store.select("instantType") as string | undefined) ?? undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(positioner.arrowStyles() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
      ref={elementRef}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

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

export type TooltipArrowProps<T extends JSX.ElementType = "div"> = ButtonEventHandlers & RebaseUIComponentProps<T, TooltipArrowState>;

export namespace TooltipArrow {
  export type State = TooltipArrowState;
  export type Props<T extends JSX.ElementType = "div"> = TooltipArrowProps<T>;
}

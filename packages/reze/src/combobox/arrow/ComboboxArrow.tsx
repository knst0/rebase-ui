import { dynamicElement, omitProps, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxPositionerContext } from "../positioner/ComboboxPositionerContext";
import { useComboboxRootContext } from "../root/ComboboxRootContext";

/**
 * Displays an element positioned against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxArrow<T extends JSX.ElementType = "div">(props: ComboboxArrow.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useComboboxRootContext();
  const positioner = useComboboxPositionerContext();

  function snapshot(): ComboboxArrowState {
    return {
      open: store.select("open") as boolean,
      side: positioner.side(),
      align: positioner.align(),
      uncentered: positioner.arrowUncentered(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        aria-hidden="true"
        data-open={(store.select("open") as boolean) ? "" : undefined}
        data-closed={(store.select("open") as boolean) ? undefined : ""}
        data-side={positioner.side()}
        data-align={positioner.align()}
        data-uncentered={positioner.arrowUncentered() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(positioner.arrowStyles() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
        ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: Element | null) => {
          positioner.arrowRef.current = element;
        })}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

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
      ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: Element | null) => {
        positioner.arrowRef.current = element;
      })}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface ComboboxArrowState {
  /**
   * Whether the popup is currently open.
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

export type ComboboxArrowProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ComboboxArrowState>;

export namespace ComboboxArrow {
  export type State = ComboboxArrowState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxArrowProps<T>;
}

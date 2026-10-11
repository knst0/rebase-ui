import { dynamicElement, omitProps, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectPositionerContext } from "../positioner/SelectPositionerContext";
import { useSelectRootContext } from "../root/SelectRootContext";

/**
 * Displays an element positioned against the select popup anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Select](https://rebase-ui.knst.dev/components/select)
 */
export function SelectArrow<T extends JSX.ElementType = "div">(props: SelectArrow.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useSelectRootContext();
  const positioner = useSelectPositionerContext();

  function snapshot(): SelectArrowState {
    return {
      open: store.select("open") as boolean,
      side: positioner.side(),
      align: positioner.align(),
      uncentered: positioner.arrowUncentered(),
    };
  }

  function ref(element: Element | null): void {
    positioner.arrowRef.current = element;
    (props.ref as ((element: Element | null) => void) | undefined)?.(element);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {!positioner.alignItemWithTriggerActive() && (
          <div
            {...(rest as Record<string, unknown>)}
            aria-hidden="true"
            data-open={(store.select("open") as boolean) ? "" : undefined}
            data-closed={(store.select("open") as boolean) ? undefined : ""}
            data-anchor-hidden={positioner.anchorHidden() ? "" : undefined}
            data-side={positioner.side()}
            data-align={positioner.align()}
            data-uncentered={positioner.arrowUncentered() ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={mergeStyleValue(positioner.arrowStyles() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
            ref={ref}
          >
            {resolveChildrenValue(children, snapshot)}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {!positioner.alignItemWithTriggerActive() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          aria-hidden="true"
          data-open={(store.select("open") as boolean) ? "" : undefined}
          data-closed={(store.select("open") as boolean) ? undefined : ""}
          data-anchor-hidden={positioner.anchorHidden() ? "" : undefined}
          data-side={positioner.side()}
          data-align={positioner.align()}
          data-uncentered={positioner.arrowUncentered() ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={mergeStyleValue(positioner.arrowStyles() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
          ref={ref}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </>
  );
}

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

export type SelectArrowProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, SelectArrowState>;

export namespace SelectArrow {
  export type State = SelectArrowState;
  export type Props<T extends JSX.ElementType = "div"> = SelectArrowProps<T>;
}

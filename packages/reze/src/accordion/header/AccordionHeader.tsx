import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { AccordionItemState } from "../item/AccordionItem";
import { useAccordionItemContext } from "../item/AccordionItemContext";

/**
 * A heading that labels the corresponding panel.
 * Renders an `<h3>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/accordion)
 */
export function AccordionHeader<T extends JSX.ElementType = "h3">(props: AccordionHeader.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { state } = useAccordionItemContext();

  function snapshot(): AccordionHeaderState {
    return {
      value: state.value(),
      disabled: state.disabled(),
      hidden: state.hidden(),
      index: state.index(),
      open: state.open(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "h3");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would destroy the trigger (and its focus)
  // every time the panel appears or disappears. The default path renders a
  // static `<h3>` so updates patch it in place; only a customized `as` keeps
  // the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <h3
        {...(rest as Record<string, unknown>)}
        data-open={state.open() ? "" : undefined}
        data-closed={state.open() ? undefined : ""}
        data-index={String(state.index())}
        data-disabled={state.disabled() ? "" : undefined}
        data-hidden={state.hidden() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, snapshot)}
      </h3>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-open={state.open() ? "" : undefined}
      data-closed={state.open() ? undefined : ""}
      data-index={String(state.index())}
      data-disabled={state.disabled() ? "" : undefined}
      data-hidden={state.hidden() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface AccordionHeaderState extends AccordionItemState {}

export type AccordionHeaderProps<T extends JSX.ElementType = "h3"> = RebaseUIComponentProps<T, AccordionHeaderState>;

export namespace AccordionHeader {
  export type State = AccordionHeaderState;
  export type Props<T extends JSX.ElementType = "h3"> = AccordionHeaderProps<T>;
}

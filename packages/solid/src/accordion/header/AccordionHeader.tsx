import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { AccordionItemState } from "../item/AccordionItem";
import { useAccordionItemContext } from "../item/AccordionItemContext";
import { accordionStateAttributesMapping } from "../item/stateAttributesMapping";

export function AccordionHeader<T extends ValidComponent = "h3">(props: AccordionHeader.Props<T>) {
  const [local, elementProps] = split(props as AccordionHeader.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { state } = useAccordionItemContext();

  return <RenderElement as={as} state={state} props={[elementProps]} stateAttributesMapping={accordionStateAttributesMapping} />;
}

const defaultProps = Object.freeze({
  as: "h3",
} satisfies Partial<AccordionHeader.Props>);

export interface AccordionHeaderState extends AccordionItemState {}

export type AccordionHeaderProps<T extends ValidComponent = "h3"> = RebaseUIComponentProps<T, AccordionHeaderState>;

export namespace AccordionHeader {
  export type State = AccordionHeaderState;
  export type Props<T extends ValidComponent = "h3"> = AccordionHeaderProps<T>;
}

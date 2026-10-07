import type { Accessor, Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { AccordionItemState } from "./AccordionItem";

export interface AccordionItemContext {
  open: Accessor<boolean>;
  state: AccordionItemState;
  triggerId: Accessor<string>;
  setTriggerId: Setter<string>;
}

export const AccordionItemContext = createContext<AccordionItemContext>();

export function useAccordionItemContext(): AccordionItemContext {
  const context = useContext(AccordionItemContext);
  if (context === undefined) {
    throw new Error("Rebase UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.");
  }

  return context;
}

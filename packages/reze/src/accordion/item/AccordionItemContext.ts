import { createContext, useContext } from "reze-js";

import type { AccordionItemStateAccessors } from "./AccordionItem";

export interface AccordionItemContext {
  open: () => boolean;
  state: AccordionItemStateAccessors;
  triggerId: () => string;
  setTriggerId: (id: string) => void;
}

export const AccordionItemContext = createContext<AccordionItemContext | undefined>(undefined);

export function useAccordionItemContext(): AccordionItemContext {
  const context = useContext(AccordionItemContext);
  if (context === undefined) {
    throw new Error("Rebase UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.");
  }

  return context;
}

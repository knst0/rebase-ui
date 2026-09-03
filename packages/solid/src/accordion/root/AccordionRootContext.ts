import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { AccordionRootChangeEventDetails, AccordionRootState, AccordionValue } from "./AccordionRoot";

export interface AccordionRootContext<Value = any> {
  disabled: Accessor<boolean>;
  handleValueChange: (newValue: AccordionValue<Value>[number], nextOpen: boolean, eventDetails: AccordionRootChangeEventDetails) => void;
  hiddenUntilFound: Accessor<boolean>;
  keepMounted: Accessor<boolean>;
  state: AccordionRootState<Value>;
  value: Accessor<AccordionValue<Value>>;
}

export const AccordionRootContext = createContext<AccordionRootContext>();

export function useAccordionRootContext<Value = any>(): AccordionRootContext<Value> {
  const context = useContext(AccordionRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: AccordionRootContext is missing. Accordion parts must be placed within <Accordion.Root>.");
  }

  return context as AccordionRootContext<Value>;
}

import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { AccordionRoot } from "./AccordionRoot";

export interface AccordionRootContext<Value = any> {
  disabled: Accessor<boolean>;
  handleValueChange: (
    newValue: AccordionRoot.Value<Value>[number],
    nextOpen: boolean,
    eventDetails: AccordionRoot.ChangeEventDetails,
  ) => void;
  hiddenUntilFound: Accessor<boolean>;
  keepMounted: Accessor<boolean>;
  state: AccordionRoot.State<Value>;
  value: Accessor<AccordionRoot.Value<Value>>;
}

export const AccordionRootContext = createContext<AccordionRootContext>();

export function useAccordionRootContext<Value = any>(): AccordionRootContext<Value> {
  const context = useContext(AccordionRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: AccordionRootContext is missing. Accordion parts must be placed within <Accordion.Root>.");
  }

  return context as AccordionRootContext<Value>;
}

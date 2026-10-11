import { createContext, useContext } from "reze-js";

import type { AccordionRoot } from "./AccordionRoot";

export interface AccordionRootContext<Value = any> {
  disabled: () => boolean;
  handleValueChange: (
    newValue: AccordionRoot.Value<Value>[number],
    nextOpen: boolean,
    eventDetails: AccordionRoot.ChangeEventDetails,
  ) => void;
  hiddenUntilFound: boolean;
  keepMounted: boolean;
  state: {
    value: () => AccordionRoot.Value<Value>;
    disabled: () => boolean;
  };
  value: () => AccordionRoot.Value<Value>;
}

export const AccordionRootContext = createContext<AccordionRootContext<any> | undefined>(undefined);

export function useAccordionRootContext<Value = any>(): AccordionRootContext<Value> {
  const context = useContext(AccordionRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: AccordionRootContext is missing. Accordion parts must be placed within <Accordion.Root>.");
  }

  return context as AccordionRootContext<Value>;
}

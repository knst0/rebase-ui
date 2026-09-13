import type { Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";

export interface SelectGroupContext {
  labelId: string | undefined;
  setLabelId: Setter<string | undefined>;
}

export const SelectGroupContext = createContext<SelectGroupContext>();

export function useSelectGroupContext(): SelectGroupContext {
  const context = useContext(SelectGroupContext);
  if (context === undefined) {
    throw new Error(
      "Rebase UI: SelectGroupContext is missing. SelectGroup parts must be placed within <Select.Group>.",
    );
  }
  return context;
}

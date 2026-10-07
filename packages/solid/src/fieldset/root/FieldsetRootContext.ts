import type { Accessor, Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";

export interface FieldsetRootContext {
  legendId: Accessor<string | undefined>;
  setLegendId: Setter<string | undefined>;
  disabled: Accessor<boolean>;
}

export const FieldsetRootContext = createContext<FieldsetRootContext>();

export function useFieldsetRootContext(optional: true): FieldsetRootContext | undefined;
export function useFieldsetRootContext(optional?: false): FieldsetRootContext;
export function useFieldsetRootContext(optional = false) {
  const context = useContext(FieldsetRootContext);
  if (context === undefined && !optional) {
    throw new Error("Rebase UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.");
  }

  return context;
}

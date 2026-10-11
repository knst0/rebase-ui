import { createContext, useContext } from "reze-js";

import type { RegisteredLabelIdSetter } from "../../internals/labelable-provider/createRegisteredLabelId";

export interface FieldsetRootContext {
  legendId: () => string | undefined;
  setLegendId: RegisteredLabelIdSetter;
  disabled: () => boolean;
}

export const FieldsetRootContext = createContext<FieldsetRootContext | undefined>(undefined);

export function useFieldsetRootContext(optional?: false): FieldsetRootContext;
export function useFieldsetRootContext(optional: true): FieldsetRootContext | undefined;
export function useFieldsetRootContext(optional?: boolean): FieldsetRootContext | undefined {
  const context = useContext(FieldsetRootContext);

  if (!optional && context === undefined) {
    throw new Error("Rebase UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.");
  }

  return context;
}

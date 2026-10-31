import { createContext, useContext } from "reze-js";

import type { RegisteredLabelIdSetter } from "../../internals/labelable-provider/createRegisteredLabelId";
import type { ProgressRootState } from "./ProgressRoot";

export interface ProgressRootContext {
  /**
   * Formatted value of the component.
   */
  formattedValue: () => string;
  labelId: () => string | undefined;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   * `null` while the progress is indeterminate.
   */
  percentageValue: () => number | null;
  /**
   * Value of the component.
   */
  value: () => number | null;
  setLabelId: RegisteredLabelIdSetter;
  state: () => ProgressRootState;
}

export const ProgressRootContext = createContext<ProgressRootContext | undefined>(undefined);

export function useProgressRootContext(): ProgressRootContext {
  const context = useContext(ProgressRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ProgressRootContext is missing. Progress parts must be placed within <Progress.Root>.");
  }

  return context;
}

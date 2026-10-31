import type { Accessor, Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { ProgressRootState } from "./ProgressRoot";

export interface ProgressRootContext {
  /**
   * Formatted value of the component.
   */
  formattedValue: Accessor<string>;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   * `null` while the progress is indeterminate.
   */
  percentageValue: Accessor<number | null>;
  /**
   * Value of the component.
   */
  value: Accessor<number | null>;
  setLabelId: Setter<string | undefined>;
  state: ProgressRootState;
}

export const ProgressRootContext = createContext<ProgressRootContext>();

export function useProgressRootContext(): ProgressRootContext {
  const context = useContext(ProgressRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ProgressRootContext is missing. Progress parts must be placed within <Progress.Root>.");
  }

  return context;
}

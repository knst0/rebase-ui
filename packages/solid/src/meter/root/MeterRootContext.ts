import type { Accessor, Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { MeterRootState } from "./MeterRoot";

export interface MeterRootContext {
  formattedValue: Accessor<string>;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   */
  percentageValue: Accessor<number>;
  setLabelId: Setter<string | undefined>;
  state: MeterRootState;
  value: Accessor<number>;
}

export const MeterRootContext = createContext<MeterRootContext>();

export function useMeterRootContext(): MeterRootContext {
  const context = useContext(MeterRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: MeterRootContext is missing. Meter parts must be placed within <Meter.Root>.");
  }

  return context;
}

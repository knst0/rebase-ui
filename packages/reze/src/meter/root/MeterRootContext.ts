import { createContext, useContext } from "reze-js";

import type { RegisteredLabelIdSetter } from "../../internals/labelable-provider/createRegisteredLabelId";
import type { MeterRootState } from "./MeterRoot";

export interface MeterRootContext {
  formattedValue: () => string;
  labelId: () => string | undefined;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   */
  percentageValue: () => number;
  setLabelId: RegisteredLabelIdSetter;
  state: MeterRootState;
  value: () => number;
}

export const MeterRootContext = createContext<MeterRootContext | undefined>(undefined);

export function useMeterRootContext(): MeterRootContext {
  const context = useContext(MeterRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: MeterRootContext is missing. Meter parts must be placed within <Meter.Root>.");
  }

  return context;
}

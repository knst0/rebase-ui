import type { Accessor } from "solid-js";

import { createContext, useContext } from "../internals/context";
import type { EventReasons, RebaseUIChangeEventDetails } from "../internals/event-details";

export interface ToggleGroupContext<Value> {
  value: Accessor<readonly Value[]>;
  setGroupValue: (
    newValue: Value,
    nextPressed: boolean,
    eventDetails: RebaseUIChangeEventDetails<EventReasons["none"]>,
  ) => void;
  disabled: Accessor<boolean>;
  /**
   * Indicates whether the value has been initialized via `value` or `defaultValue` props.
   * Used to determine if Toggle should warn users about data inconsistency problems.
   */
  isValueInitialized: Accessor<boolean>;
}

export const ToggleGroupContext = createContext<ToggleGroupContext<any>>();

export function useToggleGroupContext(optional?: true): ToggleGroupContext<any> | undefined;
export function useToggleGroupContext(optional: false): ToggleGroupContext<any>;
export function useToggleGroupContext(optional = true) {
  const context = useContext(ToggleGroupContext);
  if (context === undefined && !optional) {
    throw new Error("Rebase UI: ToggleGroupContext is missing. Toggle parts must be placed within <ToggleGroup>.");
  }

  return context;
}

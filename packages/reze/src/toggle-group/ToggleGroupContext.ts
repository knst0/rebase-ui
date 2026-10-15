import { createContext, useContext } from "reze-js";

import type { EventReasons, RebaseUIChangeEventDetails } from "../internals/event-details";
import type { Orientation } from "../internals/types";

export interface ToggleGroupContext<Value = any> {
  value: () => readonly Value[];
  setGroupValue: (newValue: Value, nextPressed: boolean, eventDetails: RebaseUIChangeEventDetails<EventReasons["none"]>) => void;
  disabled: () => boolean;
  /**
   * Whether multiple toggles in the group can be pressed at the same time.
   * Carried so the group content can snapshot the full render-prop state.
   */
  multiple: () => boolean;
  /**
   * The orientation of the toggle group.
   * Carried so the group content can snapshot the full render-prop state.
   */
  orientation: () => Orientation;
  /**
   * Indicates whether the value has been initialized via `value` or `defaultValue` props.
   * Used to determine if Toggle should warn users about data inconsistency problems.
   */
  isValueInitialized: () => boolean;
}

export const ToggleGroupContext = createContext<ToggleGroupContext<any> | undefined>(undefined);

export function useToggleGroupContext(optional?: true): ToggleGroupContext<any> | undefined;
export function useToggleGroupContext(optional: false): ToggleGroupContext<any>;
export function useToggleGroupContext(optional = true) {
  const context = useContext(ToggleGroupContext);
  if (context === undefined && !optional) {
    throw new Error("Rebase UI: ToggleGroupContext is missing. Toggle parts must be placed within <ToggleGroup>.");
  }

  return context;
}

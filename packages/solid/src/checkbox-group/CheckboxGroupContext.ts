import type { Accessor } from "solid-js";

import type { CreateFieldValidationReturnValue } from "../field/root/createFieldValidation";
import { createContext, useContext } from "../internals/context";
import type { EventReasons, RebaseUIChangeEventDetails } from "../internals/event-details";
import type { LabelableContext } from "../internals/labelable-provider";
import type { CreateCheckboxGroupParentReturnValue } from "./createCheckboxGroupParent";

export interface CheckboxGroupContext {
  value: Accessor<readonly string[]>;
  setValue: (value: string[], eventDetails: RebaseUIChangeEventDetails<EventReasons["none"]>) => void;
  allValues: Accessor<string[] | undefined>;
  parent: CreateCheckboxGroupParentReturnValue;
  disabled: Accessor<boolean>;
  validation: CreateFieldValidationReturnValue;
  /**
   * `registerControlId` of the labelable scope the group renders in. A checkbox seeing the same
   * function shares that scope, so the group, not the checkbox, is the field's control.
   */
  registerControlId: LabelableContext["registerControlId"];
}

export const CheckboxGroupContext = createContext<CheckboxGroupContext>();

export function useCheckboxGroupContext(optional: true): CheckboxGroupContext | undefined;
export function useCheckboxGroupContext(optional?: false): CheckboxGroupContext;
export function useCheckboxGroupContext(optional = false) {
  const context = useContext(CheckboxGroupContext);
  if (context === undefined && !optional) {
    throw new Error("Rebase UI: CheckboxGroupContext is missing. Checkbox Group parts must be placed within <CheckboxGroup>.");
  }

  return context;
}

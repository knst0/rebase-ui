import { type Accessor, createSignal, untrack } from "solid-js";

import { EMPTY_ARRAY } from "#utils/empty";

import type { EventReasons, RebaseUIChangeEventDetails } from "../internals/event-details";

export function createCheckboxGroupParent(params: CreateCheckboxGroupParentParameters): CreateCheckboxGroupParentReturnValue {
  const allValues = () => params.allValues() ?? (EMPTY_ARRAY as readonly string[]);

  let uncontrolledState: string[] = untrack(params.value).slice();
  const disabledStates = new Map<string, boolean>();

  const [status, setStatus] = createSignal<ParentStatus>("mixed");
  // A `Map` rather than an object: checkbox values are consumer data, and a value like
  // `constructor` would otherwise read straight off `Object.prototype`.
  const childIds = new Map<string, readonly string[]>();
  const [childIdsVersion, setChildIdsVersion] = createSignal(0);

  const registerChildId = (childValue: string, childId: string) => {
    const ids = childIds.get(childValue);
    if (!ids?.includes(childId)) {
      childIds.set(childValue, ids ? ids.concat(childId) : [childId]);
      setChildIdsVersion((version) => version + 1);
    }

    return () => {
      const registeredIds = childIds.get(childValue);
      if (!registeredIds?.includes(childId)) {
        return;
      }

      const nextIds = registeredIds.filter((id) => id !== childId);
      if (nextIds.length === 0) {
        childIds.delete(childValue);
      } else {
        childIds.set(childValue, nextIds);
      }
      setChildIdsVersion((version) => version + 1);
    };
  };

  function getParentProps() {
    const all = allValues();
    const value = params.value();

    return {
      indeterminate: value.length !== all.length && value.length > 0,
      checked: value.length === all.length,
      // Children report their own rendered id, so a custom `id` survives and no unmounted
      // element is named.
      get "aria-controls"(): string | undefined {
        childIdsVersion();
        return (
          allValues()
            .flatMap((v) => childIds.get(v) ?? (EMPTY_ARRAY as readonly string[]))
            .join(" ") || undefined
        );
      },
      onCheckedChange(_: boolean, eventDetails: CheckboxGroupParentChangeEventDetails) {
        const currentAll = allValues();

        // None except the disabled ones that are checked, which can't be changed.
        const none = currentAll.filter((v) => disabledStates.get(v) && uncontrolledState.includes(v));
        // "All" that are valid: any that aren't disabled, plus disabled ones that are checked.
        const allValid = currentAll.filter((v) => !disabledStates.get(v) || uncontrolledState.includes(v));

        const allOnOrOff = uncontrolledState.length === allValid.length || uncontrolledState.length === 0;

        if (allOnOrOff) {
          if (params.value().length === allValid.length) {
            params.onValueChange(none, eventDetails);
          } else {
            params.onValueChange(allValid, eventDetails);
          }
          return;
        }

        let nextStatus: ParentStatus = "mixed";
        let nextValue = uncontrolledState;

        if (status() === "mixed") {
          nextStatus = "on";
          nextValue = allValid;
        } else if (status() === "on") {
          nextStatus = "off";
          nextValue = none;
        }

        params.onValueChange(nextValue, eventDetails);

        if (!eventDetails.isCanceled) {
          setStatus(nextStatus);
        }
      },
    };
  }

  function getChildProps(childValue: string) {
    return {
      checked: params.value().includes(childValue),
      onCheckedChange(nextChecked: boolean, eventDetails: CheckboxGroupParentChangeEventDetails) {
        const newValue = params.value().slice();
        if (nextChecked) {
          newValue.push(childValue);
        } else {
          newValue.splice(newValue.indexOf(childValue), 1);
        }

        params.onValueChange(newValue, eventDetails);

        if (!eventDetails.isCanceled) {
          uncontrolledState = newValue;
          setStatus("mixed");
        }
      },
    };
  }

  return { getParentProps, getChildProps, registerChildId, disabledStates };
}

type ParentStatus = "on" | "off" | "mixed";

export type CheckboxGroupParentChangeEventDetails = RebaseUIChangeEventDetails<EventReasons["none"]>;

export interface CreateCheckboxGroupParentParameters {
  allValues: Accessor<string[] | undefined>;
  value: Accessor<readonly string[]>;
  onValueChange: (value: string[], eventDetails: CheckboxGroupParentChangeEventDetails) => void;
}

export interface CreateCheckboxGroupParentReturnValue {
  disabledStates: Map<string, boolean>;
  /**
   * Reports the `id` of the element a child checkbox exposes.
   */
  registerChildId: (value: string, id: string) => () => void;
  getParentProps: () => {
    indeterminate: boolean;
    checked: boolean;
    readonly "aria-controls": string | undefined;
    onCheckedChange: (checked: boolean, eventDetails: CheckboxGroupParentChangeEventDetails) => void;
  };
  getChildProps: (value: string) => {
    checked: boolean;
    onCheckedChange: (checked: boolean, eventDetails: CheckboxGroupParentChangeEventDetails) => void;
  };
}

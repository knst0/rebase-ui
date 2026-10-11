import { effect, onCleanup, untrack } from "reze-js";

import type { FieldValidityData, FieldValiditySetter } from "../../field/root/FieldRoot";
import { getCombinedFieldValidityData } from "../../field/utils/getCombinedFieldValidityData";
import { useFormContext } from "../form-context";

export interface FieldControlRegistration {
  readonly controlElement: HTMLElement | null;
  id: string | undefined;
  name?: string | undefined;
  getValue?: (() => unknown) | undefined;
  value: unknown;
}

export interface CreateFieldControlRegistrationParameters {
  change: (value: unknown, cancelPending?: boolean) => void;
  commit: (value: unknown) => void;
  invalid: () => boolean;
  setMarkedDirty: (value: boolean) => void;
  name: () => string | undefined;
  setRegisteredFieldName: (name: string | undefined) => void;
  setRegisteredFieldId: (id: string | undefined) => void;
  setValidityData: FieldValiditySetter;
  validityData: FieldValidityData;
}

export type CreateFieldControlRegistrationReturnValue = readonly [
  validate: () => void,
  register: (source: object, registration: FieldControlRegistration | undefined) => void,
];

function readValidityDataDeep(data: FieldValidityData): unknown[] {
  const state = data.state;
  return [
    state.badInput,
    state.customError,
    state.patternMismatch,
    state.rangeOverflow,
    state.rangeUnderflow,
    state.stepMismatch,
    state.tooLong,
    state.tooShort,
    state.typeMismatch,
    state.valueMissing,
    state.valid,
    data.error,
    ...data.errors,
    data.value,
    data.initialValue,
    data.isValidating,
  ];
}

export function createFieldControlRegistration(
  params: CreateFieldControlRegistrationParameters,
): CreateFieldControlRegistrationReturnValue {
  const {
    change,
    commit,
    invalid,
    setMarkedDirty,
    name,
    setRegisteredFieldName,
    setRegisteredFieldId,
    setValidityData,
    validityData,
  } = params;

  const { fields } = useFormContext();

  let activeFieldControlSource: object | null = null;
  let currentRegistration: FieldControlRegistration | null = null;
  let initialValueCaptured = false;

  function getValueForForm() {
    if (!currentRegistration) {
      return undefined;
    }

    if (currentRegistration.getValue) {
      return currentRegistration.getValue();
    }

    return currentRegistration.value;
  }

  function getRegistrationValue(registration: FieldControlRegistration) {
    return registration.value === undefined ? getValueForForm() : registration.value;
  }

  function validate() {
    setMarkedDirty(true);

    if (!currentRegistration) {
      commit(validityData.value);
      return;
    }

    commit(getRegistrationValue(currentRegistration));
  }

  function setField(registration: FieldControlRegistration) {
    untrack(() => {
      fields.set(registration.id as string, {
        getValue: getValueForForm,
        name: name() ?? registration.name,
        get controlElement() {
          return registration.controlElement;
        },
        validityData: getCombinedFieldValidityData(validityData, invalid()),
        validate,
      });
    });
  }

  function refreshRegistration() {
    if (!currentRegistration || !currentRegistration.id) {
      return;
    }

    setField(currentRegistration);
  }

  function deleteRegistration(id = currentRegistration?.id) {
    if (id) {
      fields.delete(id);
    }
  }

  function captureInitialValue(registration: FieldControlRegistration) {
    if (initialValueCaptured) {
      return;
    }

    initialValueCaptured = true;
    const initialValue = getRegistrationValue(registration);

    setValidityData((draft) => {
      draft.initialValue = initialValue;
    });
  }

  effect(() => {
    const fieldName = name();
    invalid();
    readValidityDataDeep(validityData);

    // Actions never subscribe: the registration sync below only writes, so the
    // effect tracks just the field name, the invalid state, and the validity data.
    untrack(() => {
      if (!currentRegistration || !currentRegistration.id) {
        return;
      }

      setRegisteredFieldName(fieldName ? undefined : currentRegistration.name);
      setField(currentRegistration);
    });
  });

  onCleanup(() => {
    deleteRegistration();
  });

  function register(source: object, registration: FieldControlRegistration | undefined) {
    if (!registration) {
      if (activeFieldControlSource === source) {
        activeFieldControlSource = null;
        change(undefined, true);
        deleteRegistration();
        currentRegistration = null;
        setRegisteredFieldName(undefined);
        setRegisteredFieldId(undefined);
      }
      return;
    }

    const previousId = currentRegistration?.id;
    const previousSource = activeFieldControlSource;

    if (previousSource && previousSource !== source) {
      change(undefined, true);
    }

    activeFieldControlSource = source;
    currentRegistration = registration;
    if (!name()) {
      setRegisteredFieldName(registration.name);
    }
    setRegisteredFieldId(registration.id);

    if (previousId && previousId !== registration.id) {
      deleteRegistration(previousId);
    }

    captureInitialValue(registration);
    refreshRegistration();
  }

  return [validate, register] as const;
}

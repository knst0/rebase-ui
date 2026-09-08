import { type Accessor, createRenderEffect, onCleanup, type Setter, untrack } from "solid-js";

import type { FieldValidityData } from "../../field/root/FieldRoot";
import { getCombinedFieldValidityData } from "../../field/utils/getCombinedFieldValidityData";
import { useFormContext } from "../form-context";

export interface FieldControlRegistration {
  readonly controlElement: HTMLElement | null;
  id: string | undefined;
  name?: string | undefined;
  getValue?: Accessor<unknown> | undefined;
  value: unknown;
}

export interface CreateFieldControlRegistrationParameters {
  commit: (value: unknown) => void;
  invalid: Accessor<boolean>;
  setMarkedDirty: (value: boolean) => void;
  name: Accessor<string | undefined>;
  setRegisteredFieldName: (name: string | undefined) => void;
  setRegisteredFieldId: (id: string | undefined) => void;
  setValidityData: Setter<FieldValidityData>;
  validityData: Accessor<FieldValidityData>;
}

export type CreateFieldControlRegistrationReturnValue = readonly [
  validate: () => void,
  register: (source: symbol, registration: FieldControlRegistration | undefined) => void,
];

export function createFieldControlRegistration(
  params: CreateFieldControlRegistrationParameters,
): CreateFieldControlRegistrationReturnValue {
  const { commit, invalid, setMarkedDirty, name, setRegisteredFieldName, setRegisteredFieldId, setValidityData, validityData } = params;

  const { fields } = useFormContext();

  let activeFieldControlSource: symbol | null = null;
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
      commit(validityData().value);
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
        validityData: getCombinedFieldValidityData(validityData(), invalid()),
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

    setValidityData((prev) => (prev.initialValue === initialValue ? prev : { ...prev, initialValue }));
  }

  createRenderEffect(
    () => ({ fieldName: name(), isInvalid: invalid(), data: validityData() }),
    ({ fieldName }) => {
      if (!currentRegistration || !currentRegistration.id) {
        return;
      }

      setRegisteredFieldName(fieldName ? undefined : currentRegistration.name);
      setField(currentRegistration);
    },
  );

  onCleanup(() => {
    deleteRegistration();
  });

  function register(source: symbol, registration: FieldControlRegistration | undefined) {
    if (!registration) {
      if (activeFieldControlSource === source) {
        activeFieldControlSource = null;
        deleteRegistration();
        currentRegistration = null;
        setRegisteredFieldName(undefined);
        setRegisteredFieldId(undefined);
      }
      return;
    }

    const previousId = currentRegistration?.id;

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

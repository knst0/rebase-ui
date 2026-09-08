import { type Accessor, createEffect, createSignal, type Store, type StoreSetter } from "solid-js";

import type { Form } from "../../form/Form";
import { DEFAULT_VALIDITY_STATE } from "../../internals/field-constants";
import { useFormContext } from "../../internals/form-context";
import { useLabelableContext } from "../../internals/labelable-provider";
import { getCombinedFieldValidityData } from "../utils/getCombinedFieldValidityData";
import type { FieldRootState, FieldValidityData } from "./FieldRoot";

const validityKeys = Object.keys(DEFAULT_VALIDITY_STATE) as Array<keyof ValidityState>;

export interface RegisteredInput {
  readonly controlElement: HTMLElement | null;
  value: string | undefined;
}

export type RegisteredInputs = Map<HTMLInputElement, RegisteredInput>;

interface PendingCommit {
  value: unknown;
  revalidate: boolean;
  debounce: number;
}

export function isEligibleInput(input: HTMLInputElement, formElement: HTMLFormElement | null) {
  if (input.matches(":disabled")) {
    return false;
  }

  if (!formElement || input.form === formElement) {
    return true;
  }

  return input.form === null && !input.hasAttribute("form");
}

function findRepresentativeInput(inputs: RegisteredInputs, formElement: HTMLFormElement | null): HTMLInputElement | null {
  let fallback: HTMLInputElement | null = null;
  for (const input of inputs.keys()) {
    if (!isEligibleInput(input, formElement)) {
      continue;
    }
    if (!input.validity.valid) {
      return input;
    }
    fallback ??= input;
  }
  return fallback;
}

function clearCustomValidity(element: HTMLInputElement | null, inputs: RegisteredInputs) {
  for (const input of inputs.keys()) {
    input.setCustomValidity("");
  }
  element?.setCustomValidity("");
}

export function createFieldValidation(params: CreateFieldValidationParameters): CreateFieldValidationReturnValue {
  const { fields, formElement } = useFormContext();

  const {
    setValidityData,
    validate,
    validityData,
    validationDebounceTime,
    invalid,
    markedDirty,
    state,
    shouldValidateOnChange,
    registeredFieldId,
  } = params;

  const { controlId, getDescriptionProps } = useLabelableContext();

  const registeredInputs: RegisteredInputs = new Map();
  let inputElement: HTMLInputElement | null = null;
  let latestRun: object | null = null;

  // Debounced requests go through this signal so the effect below owns the timer: a superseded
  // request cancels the previous one through the effect's cleanup rather than through a
  // manually tracked timeout id and generation counter.
  const [pendingCommit, setPendingCommit] = createSignal<PendingCommit | undefined>(undefined);

  createEffect(
    () => pendingCommit(),
    (request) => {
      if (request === undefined) {
        return;
      }

      const timeoutId = globalThis.setTimeout(() => {
        void runCommit(request.value, request.revalidate);
      }, request.debounce);

      return () => globalThis.clearTimeout(timeoutId);
    },
  );

  function cancelPendingCommit() {
    setPendingCommit(undefined);
  }

  const registerInput = (element: HTMLInputElement, registration: RegisteredInput): void | (() => void) => {
    registeredInputs.set(element, registration);
    return () => {
      registeredInputs.delete(element);
    };
  };

  const getInputControl = () => {
    const element = findRepresentativeInput(registeredInputs, formElement);
    return (element && registeredInputs.get(element)?.controlElement) || null;
  };

  async function runCommit(value: unknown, revalidate = false) {
    const run = {};
    latestRun = run;

    function updateRegisteredFieldValidity(nextValidityData: FieldValidityData, externalInvalid = invalid()) {
      const fieldId = registeredFieldId() ?? controlId();
      if (fieldId == null) {
        return;
      }

      const currentFieldData = fields.get(fieldId);
      if (!currentFieldData) {
        return;
      }

      fields.set(fieldId, {
        ...currentFieldData,
        validityData: getCombinedFieldValidityData(nextValidityData, externalInvalid),
      });
    }

    function publishAllValid(input: HTMLInputElement | null, externalInvalid?: boolean) {
      const nextValidityData = {
        value,
        state: { ...DEFAULT_VALIDITY_STATE, valid: true },
        error: "",
        errors: [],
        initialValue: validityData.initialValue,
      };
      clearCustomValidity(input, registeredInputs);
      updateRegisteredFieldValidity(nextValidityData, externalInvalid);
      setValidityData(() => nextValidityData);
    }

    const element = registeredInputs.size > 0 ? findRepresentativeInput(registeredInputs, formElement) : inputElement;

    if (revalidate) {
      if (state.valid() !== false || !element) {
        return;
      }

      const currentNativeValidity = element.validity;

      if (!currentNativeValidity.valueMissing) {
        publishAllValid(element, false);
        return;
      }

      for (const key of validityKeys) {
        if (key !== "valid" && key !== "valueMissing" && key !== "customError" && currentNativeValidity[key]) {
          return;
        }
      }
    }

    function getState(el: HTMLInputElement) {
      const computedState = validityKeys.reduce(
        (acc, key) => {
          acc[key] = el.validity[key];
          return acc;
        },
        {} as Record<keyof ValidityState, boolean>,
      );

      let hasOnlyValueMissingError = false;

      for (const key of validityKeys) {
        if (key === "valid") {
          continue;
        }
        if (key === "valueMissing" && computedState[key]) {
          hasOnlyValueMissingError = true;
        } else if (computedState[key]) {
          return computedState;
        }
      }

      if (hasOnlyValueMissingError && !markedDirty()) {
        computedState.valid = true;
        computedState.valueMissing = false;
      }
      return computedState;
    }

    let result: null | string | string[] = null;
    let validationErrors: string[] = [];

    const nextState: Record<keyof ValidityState, boolean> = element ? getState(element) : { ...DEFAULT_VALIDITY_STATE, valid: true };

    let defaultValidationMessage: string | undefined;
    const isValidatingOnChange = shouldValidateOnChange();

    if (element && element.validationMessage && !isValidatingOnChange) {
      defaultValidationMessage = element.validationMessage;
      validationErrors = [element.validationMessage];
    } else {
      const formValues = Array.from(fields.values()).reduce((acc, field) => {
        if (field.name) {
          acc[field.name] = field.getValue();
        }
        return acc;
      }, {} as Form.Values);

      const resultOrPromise = validate(value, formValues);
      if (typeof resultOrPromise === "object" && resultOrPromise !== null && "then" in resultOrPromise) {
        result = await resultOrPromise;
        if (latestRun !== run) {
          return;
        }
      } else {
        result = resultOrPromise;
      }

      if (result !== null) {
        nextState.valid = false;
        nextState.customError = true;

        if (Array.isArray(result)) {
          validationErrors = result;
          element?.setCustomValidity(result.join("\n"));
        } else if (result) {
          validationErrors = [result];
          element?.setCustomValidity(result);
        }
      } else if (isValidatingOnChange) {
        clearCustomValidity(element, registeredInputs);
        nextState.customError = false;

        if (element && element.validationMessage) {
          defaultValidationMessage = element.validationMessage;
          validationErrors = [element.validationMessage];
        } else if ((!element || element.validity.valid) && !nextState.valid) {
          nextState.valid = true;
        }
      }
    }

    const nextValidityData = {
      value,
      state: nextState,
      error: defaultValidationMessage ?? (Array.isArray(result) ? result[0] : (result ?? "")),
      errors: validationErrors,
      initialValue: validityData.initialValue,
    };

    updateRegisteredFieldValidity(nextValidityData);

    setValidityData(() => nextValidityData);
  }

  const commit = async (value: unknown, revalidate = false) => {
    cancelPendingCommit();
    await runCommit(value, revalidate);
  };

  const change = (value: unknown, cancelPending = false) => {
    const validateOnChange = shouldValidateOnChange();

    if (cancelPending) {
      cancelPendingCommit();
      return;
    }

    if (validateOnChange && value !== "" && validationDebounceTime) {
      // Replacing the request supersedes any in-flight timer via the effect's cleanup.
      setPendingCommit({ value, revalidate: false, debounce: validationDebounceTime });
    } else {
      cancelPendingCommit();
      void runCommit(value, !validateOnChange);
    }
  };

  const getValidationProps = (disabled: boolean, externalProps: Record<string, any> = {}) => {
    const describedProps = getDescriptionProps(externalProps);

    const target: Record<string, any> = {};
    for (const key in describedProps) {
      if (key === "aria-invalid") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => describedProps[key] });
    }
    Object.defineProperty(target, "aria-invalid", {
      enumerable: true,
      configurable: true,
      get: () => (state.valid() === false && !state.disabled() && !disabled ? "true" : undefined),
    });
    return target;
  };

  return {
    getValidationProps,
    get inputElement() {
      return inputElement;
    },
    set inputElement(element: HTMLInputElement | null) {
      inputElement = element;
    },
    registeredInputs,
    registerInput,
    getInputControl,
    commit,
    change,
  };
}

export interface CreateFieldValidationParameters {
  setValidityData: StoreSetter<FieldValidityData>;
  validate: (value: unknown, formValues: Form.Values) => string | string[] | null | Promise<string | string[] | null>;
  validityData: Store<FieldValidityData>;
  validationDebounceTime: number;
  invalid: Accessor<boolean>;
  markedDirty: () => boolean; // fixme: реактивное?
  state: FieldRootState;
  shouldValidateOnChange: () => boolean; // fixme: реактивное?
  registeredFieldId: () => string | undefined; // fixme: реактивное?
}

export interface CreateFieldValidationReturnValue {
  getValidationProps: (disabled: boolean, props?: Record<string, any>) => Record<string, any>;
  inputElement: HTMLInputElement | null;
  registeredInputs: RegisteredInputs;
  registerInput: (element: HTMLInputElement, registration: RegisteredInput) => void | (() => void);
  getInputControl: () => HTMLElement | null;
  commit: (value: unknown) => Promise<void>;
  change: (value: unknown, cancelPending?: boolean) => void;
}

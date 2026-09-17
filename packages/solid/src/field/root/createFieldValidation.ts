import { type Accessor, onCleanup, type Store, type StoreSetter, untrack } from "solid-js";

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

function getElementValidityState(el: HTMLInputElement, isMarkedDirty: boolean): Record<keyof ValidityState, boolean> {
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

  if (hasOnlyValueMissingError && !isMarkedDirty) {
    computedState.valid = true;
    computedState.valueMissing = false;
  }
  return computedState;
}

export function createFieldValidation(params: CreateFieldValidationParameters): CreateFieldValidationReturnValue {
  const { fields, formElement } = useFormContext();

  const {
    setValidityData,
    validate,
    validityData,
    validationDebounceTime,
    validationMode,
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

  // The debounce timer is owned directly: a superseding request clears the previous timeout,
  // and unmount clears any pending one. This keeps the keystroke path free of a signal
  // round-trip and of tracking-scope boundaries for the one-shot reads inside `runCommit`.
  let debounceTimeoutId: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearPendingCommit();
  });

  function clearPendingCommit() {
    if (debounceTimeoutId !== undefined) {
      globalThis.clearTimeout(debounceTimeoutId);
      debounceTimeoutId = undefined;
    }
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

  function updateRegisteredFieldValidity(nextValidityData: FieldValidityData, externalInvalid?: boolean) {
    const resolvedExternalInvalid = externalInvalid ?? untrack(invalid);
    const fieldId = untrack(registeredFieldId) ?? untrack(controlId);
    if (fieldId == null) {
      return;
    }

    const currentFieldData = fields.get(fieldId);
    if (!currentFieldData) {
      return;
    }

    fields.set(fieldId, {
      ...currentFieldData,
      validityData: getCombinedFieldValidityData(nextValidityData, resolvedExternalInvalid),
    });
  }

  function publishAllValid(input: HTMLInputElement | null, value: unknown, externalInvalid?: boolean) {
    const nextValidityData = {
      value,
      state: { ...DEFAULT_VALIDITY_STATE, valid: true },
      error: "",
      errors: [],
      initialValue: untrack(() => validityData.initialValue),
      isValidating: false,
    };
    clearCustomValidity(input, registeredInputs);
    updateRegisteredFieldValidity(nextValidityData, externalInvalid);
    setValidityData(() => nextValidityData);
  }

  function publishPendingValidity(value: unknown, state: FieldValidityData["state"], errors: string[]) {
    const nextValidityData = {
      value,
      state,
      error: errors[0] ?? "",
      errors,
      initialValue: untrack(() => validityData.initialValue),
      isValidating: true,
    };
    updateRegisteredFieldValidity(nextValidityData);
    setValidityData(() => nextValidityData);
  }

  async function runCommit(value: unknown, revalidate = false) {
    const run = {};
    latestRun = run;

    const element = registeredInputs.size > 0 ? findRepresentativeInput(registeredInputs, formElement) : inputElement;

    if (revalidate) {
      if (untrack(state.valid) !== false || !element) {
        // This run supersedes any in-flight async validation without publishing,
        // so retire its pending flag instead of leaking it.
        setValidityData((draft) => {
          draft.isValidating = false;
        });
        return;
      }

      const currentNativeValidity = element.validity;

      if (!currentNativeValidity.valueMissing) {
        publishAllValid(element, value, false);
        return;
      }
      for (const key of validityKeys) {
        if (key !== "valid" && key !== "valueMissing" && key !== "customError" && currentNativeValidity[key]) {
          setValidityData((draft) => {
            draft.isValidating = false;
          });
          return;
        }
      }
    }

    let result: null | string | string[] = null;
    let validationErrors: string[] = [];
    const nextState: FieldValidityData["state"] = element
      ? getElementValidityState(element, markedDirty())
      : { ...DEFAULT_VALIDITY_STATE, valid: true };

    let defaultValidationMessage: string | undefined;
    const isValidatingOnChange = untrack(shouldValidateOnChange);

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
        // Validity is unknown while the validator runs, so go neutral, but keep what
        // must block submission synchronously: native failures, and a previous custom
        // error outside onSubmit mode. A previous native error is never kept, since
        // `nextState` already carries the fresh native verdict.
        if (nextState.valid === false) {
          publishPendingValidity(value, nextState, validationErrors);
        } else if (validationMode === "onSubmit" || !untrack(() => validityData.state.customError)) {
          publishPendingValidity(value, { ...nextState, valid: null }, []);
        } else {
          setValidityData((draft) => {
            draft.isValidating = true;
          });
        }

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
      initialValue: untrack(() => validityData.initialValue),
      isValidating: false,
    };

    updateRegisteredFieldValidity(nextValidityData);

    setValidityData(() => nextValidityData);
  }

  const commit = async (value: unknown, revalidate = false) => {
    clearPendingCommit();
    await runCommit(value, revalidate);
  };

  const change = (value: unknown, cancelPending = false) => {
    const validateOnChange = untrack(shouldValidateOnChange);

    clearPendingCommit();
    if (cancelPending) {
      return;
    }

    if (validateOnChange && value !== "" && validationDebounceTime) {
      // A newer request replaces the pending one by clearing its timer outright.
      debounceTimeoutId = globalThis.setTimeout(() => {
        debounceTimeoutId = undefined;
        void runCommit(value, false);
      }, validationDebounceTime);
    } else {
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
  validationMode: Form.ValidationMode;
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

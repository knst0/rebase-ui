import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createUniqueId, For, untrack } from "solid-js";

import { fieldValidityMapping } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { useLabelableContext } from "../../internals/labelable-provider";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { createTransitionStatus, type TransitionStatus, transitionStatusMapping } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useFieldItemContext } from "../item/FieldItemContext";
import type { FieldRootState } from "../root/FieldRoot";

const stateAttributesMapping: StateAttributesMapping<FieldErrorState> = {
  ...fieldValidityMapping,
  ...transitionStatusMapping,
};

/**
 * An error message displayed if the field control fails validation.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldError<T extends ValidComponent = "div">(props: FieldError.Props<T>) {
  const [local, elementProps] = split(props as FieldError.Props, { default: defaultProps }, ["as", "id", "match"]);

  const as = untrack(() => local.as);

  const generatedId = createUniqueId();
  const id = () => local.id ?? generatedId;

  const { validityData, state: fieldState, name } = useFieldRootContext(false);
  const { setMessageIds } = useLabelableContext();
  const { disabled: itemDisabled } = useFieldItemContext();

  const combinedDisabled = createMemo(() => fieldState.disabled() === true || itemDisabled());

  const { errors } = useFormContext();

  const formError = createMemo(() => {
    const currentName = name();
    if (!currentName) {
      return null;
    }
    const currentErrors = errors();
    if (!currentErrors || !Object.hasOwn(currentErrors, currentName)) {
      return null;
    }
    return currentErrors[currentName] ?? null;
  });

  const hasFormError = () => {
    const currentFormError = formError();
    return !!(Array.isArray(currentFormError) ? currentFormError.length : currentFormError);
  };
  const hasSpecificMatch = () => typeof local.match === "string";

  const rendered = createMemo(() => {
    if (local.match === true) {
      return true;
    }
    if (combinedDisabled()) {
      return false;
    }
    if (hasSpecificMatch()) {
      return Boolean(validityData().state[local.match as keyof ValidityState]);
    }
    return hasFormError() || validityData().state.valid === false;
  });

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(rendered);

  createEffect(
    () => ({ isRendered: rendered(), currentId: id() }),
    ({ isRendered, currentId }) => {
      if (!isRendered || !currentId) {
        return;
      }

      setMessageIds((v) => v.concat(currentId));

      return () => {
        setMessageIds((v) => v.filter((item) => item !== currentId));
      };
    },
  );

  let errorElement: HTMLElement | null = null;

  let lastRenderedMessage: JSX.Element;
  let lastRenderedMessageKey: string | null = null;

  const error = createMemo<string | string[] | null | undefined>(() => {
    if (!hasSpecificMatch() && hasFormError()) {
      return formError();
    }
    if (validityData().errors.length > 1) {
      return validityData().errors;
    }
    return validityData().error;
  });

  const errorMessage = createMemo<JSX.Element>(() => {
    const currentError = error();
    if (Array.isArray(currentError)) {
      return currentError.length > 1 ? (
        <ul>
          <For each={currentError}>{(message) => <li textContent={message} />}</For>
        </ul>
      ) : (
        currentError[0]
      );
    }
    return currentError ?? "";
  });

  const errorKey = () => {
    const currentError = error();
    return Array.isArray(currentError) ? JSON.stringify(currentError) : (currentError ?? null);
  };

  const displayedMessage = createMemo(() => {
    const key = errorKey();
    const message = errorMessage();
    if (rendered() && key !== lastRenderedMessageKey) {
      lastRenderedMessageKey = key;
      lastRenderedMessage = message;
    }
    return rendered() ? message : lastRenderedMessage;
  });

  runOnOpenChangeComplete({
    open: rendered,
    ref: () => errorElement,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  const state: FieldErrorState = {
    ...fieldState,
    disabled: combinedDisabled,
    transitionStatus,
  };

  const errorProps = (externalProps: Record<string, any>) => ({
    get id() {
      return id();
    },
    get children() {
      return externalProps.children ?? displayedMessage();
    },
  });

  return (
    <RenderElement
      as={as}
      state={state}
      enabled={mounted}
      props={[
        errorProps,
        elementProps,
        {
          ref: (element: HTMLElement) => {
            errorElement = element;
          },
        },
      ]}
      stateAttributesMapping={stateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<FieldError.Props>);

export interface FieldErrorState extends FieldRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface FieldErrorOwnProps {
  /**
   * Determines whether to show the error message according to the field's
   * [ValidityState](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState).
   * Specifying `true` will always show the error message, and lets external libraries
   * control the visibility.
   */
  match?: boolean | keyof ValidityState | undefined;
}

export type FieldErrorProps<T extends ValidComponent = "div"> = FieldErrorOwnProps & RebaseUIComponentProps<T, FieldErrorState>;

export namespace FieldError {
  export type State = FieldErrorState;
  export type Props<T extends ValidComponent = "div"> = FieldErrorProps<T>;
  export type OwnProps = FieldErrorOwnProps;
}

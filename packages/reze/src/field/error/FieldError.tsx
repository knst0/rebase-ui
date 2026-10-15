import { createUniqueId, dynamicElement, effect, For, omitProps, onCleanup, store, type JSX } from "reze-js";

import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { useLabelableContext } from "../../internals/labelable-provider";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useFieldItemContext } from "../item/FieldItemContext";
import type { FieldRootState } from "../root/FieldRoot";

/**
 * An error message displayed if the field control fails validation.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldError<T extends JSX.ElementType = "div">(props: FieldError.Props<T>) {
  const rest = omitProps(props, "as", "id", "match", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const generatedId = createUniqueId();

  function id(): string {
    return props.id ?? generatedId;
  }

  const field = useFieldRootContext(false);
  const { setMessageIds } = useLabelableContext();
  const { disabled: itemDisabled } = useFieldItemContext();
  const { errors } = useFormContext();

  function disabled(): boolean {
    return field.state.disabled() === true || itemDisabled();
  }

  function formError(): string | string[] | null {
    const currentName = field.name();
    if (!currentName) {
      return null;
    }
    const currentErrors = errors();
    if (!currentErrors || !Object.hasOwn(currentErrors, currentName)) {
      return null;
    }
    return currentErrors[currentName] ?? null;
  }

  function hasFormError(): boolean {
    const currentFormError = formError();
    return !!(Array.isArray(currentFormError) ? currentFormError.length : currentFormError);
  }

  function hasSpecificMatch(): boolean {
    return typeof props.match === "string";
  }

  function rendered(): boolean {
    if (props.match === true) {
      return true;
    }
    if (disabled()) {
      return false;
    }
    if (hasSpecificMatch()) {
      return Boolean(field.validityData.state[props.match as keyof ValidityState]);
    }
    return hasFormError() || field.validityData.state.valid === false;
  }

  const transition = store({ mounted: false, transitionStatus: undefined as TransitionStatus });

  function setMounted(next: boolean): void {
    if (transition.mounted !== next) {
      transition.mounted = next;
    }
  }

  function setTransitionStatus(next: TransitionStatus): void {
    if (transition.transitionStatus !== next) {
      transition.transitionStatus = next;
    }
  }

  createTransitionStatus({
    open: rendered,
    mounted: () => transition.mounted,
    transitionStatus: () => transition.transitionStatus,
    setMounted,
    setTransitionStatus,
  });

  effect(() => {
    const isRendered = rendered();
    const currentId = id();
    if (!isRendered || !currentId) {
      return;
    }

    setMessageIds((v) => v.concat(currentId));

    onCleanup(() => {
      setMessageIds((v) => v.filter((item) => item !== currentId));
    });
  });

  let errorElement: HTMLElement | null = null;

  let lastRenderedMessage: JSX.Element | undefined;
  let lastRenderedMessageKey: string | null = null;

  function error(): string | string[] | null | undefined {
    if (!hasSpecificMatch() && hasFormError()) {
      return formError();
    }
    if (field.validityData.errors.length > 1) {
      return field.validityData.errors;
    }
    return field.validityData.error;
  }

  function errorMessage(): JSX.Element {
    const currentError = error();
    if (Array.isArray(currentError)) {
      return currentError.length > 1 ? (
        <ul>
          <For each={currentError}>{(message) => <li>{message}</li>}</For>
        </ul>
      ) : (
        currentError[0]
      );
    }
    return currentError ?? "";
  }

  function errorKey(): string | null {
    const currentError = error();
    return Array.isArray(currentError) ? JSON.stringify(currentError) : (currentError ?? null);
  }

  function displayedMessage(): JSX.Element | undefined {
    const key = errorKey();
    const message = errorMessage();
    if (rendered() && key !== lastRenderedMessageKey) {
      lastRenderedMessageKey = key;
      lastRenderedMessage = message;
    }
    return rendered() ? message : lastRenderedMessage;
  }

  runOnOpenChangeComplete({
    open: rendered,
    ref: () => errorElement,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  const selectors: FieldRootStateSelectors = { ...field.state, disabled };

  function snapshot(): FieldErrorState {
    return { ...getFieldStateSnapshot(selectors), transitionStatus: transition.transitionStatus };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <>
      {transition.mounted && (
        <Tag
          {...(rest as Record<string, unknown>)}
          id={id()}
          data-disabled={disabled() ? "" : undefined}
          data-valid={selectors.valid() === true ? "" : undefined}
          data-invalid={selectors.valid() === false ? "" : undefined}
          data-touched={selectors.touched() ? "" : undefined}
          data-dirty={selectors.dirty() ? "" : undefined}
          data-filled={selectors.filled() ? "" : undefined}
          data-focused={selectors.focused() ? "" : undefined}
          data-validating={selectors.validating() ? "" : undefined}
          data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
          data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={mergeRefs(
            (element: HTMLElement | null) => {
              errorElement = element;
            },
            props.ref as ((element: HTMLElement | null) => void) | undefined,
          )}
        >
          {children === undefined ? displayedMessage() : resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface FieldErrorState extends FieldRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
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

export type FieldErrorProps<T extends JSX.ElementType = "div"> = FieldErrorOwnProps & RebaseUIComponentProps<T, FieldErrorState>;

export namespace FieldError {
  export type State = FieldErrorState;
  export type Props<T extends JSX.ElementType = "div"> = FieldErrorProps<T>;
  export type OwnProps = FieldErrorOwnProps;
}

import { dynamicElement, omitProps, store, type JSX } from "reze-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useRadioRootContext } from "../root/RadioRootContext";

/**
 * Indicates whether the radio button is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Radio](https://rebase-ui.knst.dev/components/radio)
 */
export function RadioIndicator<T extends JSX.ElementType = "span">(props: RadioIndicator.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const rootState = useRadioRootContext();

  function rendered(): boolean {
    return rootState.checked();
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

  let indicatorElement: HTMLElement | null = null;

  runOnOpenChangeComplete({
    open: rendered,
    ref: () => indicatorElement,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  function snapshot(): RadioIndicatorState {
    return {
      disabled: rootState.disabled(),
      touched: rootState.touched(),
      dirty: rootState.dirty(),
      valid: rootState.valid(),
      filled: rootState.filled(),
      focused: rootState.focused(),
      validating: rootState.validating(),
      checked: rootState.checked(),
      readOnly: rootState.readOnly(),
      required: rootState.required(),
      transitionStatus: transition.transitionStatus,
    };
  }

  function setRef(element: HTMLElement | null): void {
    indicatorElement = element;
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  function shouldRender(): boolean {
    return props.keepMounted === true || transition.mounted;
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would restart the indicator's transition. The default path renders a
  // static `<span>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {shouldRender() && (
          <span
            {...(rest as Record<string, unknown>)}
            data-checked={rootState.checked() ? "" : undefined}
            data-unchecked={rootState.checked() ? undefined : ""}
            data-disabled={rootState.disabled() ? "" : undefined}
            data-readonly={rootState.readOnly() ? "" : undefined}
            data-required={rootState.required() ? "" : undefined}
            data-valid={rootState.valid() === true ? "" : undefined}
            data-invalid={rootState.valid() === false ? "" : undefined}
            data-touched={rootState.touched() ? "" : undefined}
            data-dirty={rootState.dirty() ? "" : undefined}
            data-filled={rootState.filled() ? "" : undefined}
            data-focused={rootState.focused() ? "" : undefined}
            data-validating={rootState.validating() ? "" : undefined}
            data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
            data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={setRef}
          >
            {resolveChildrenValue(children, snapshot)}
          </span>
        )}
      </>
    );
  }

  return (
    <>
      {shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          data-checked={rootState.checked() ? "" : undefined}
          data-unchecked={rootState.checked() ? undefined : ""}
          data-disabled={rootState.disabled() ? "" : undefined}
          data-readonly={rootState.readOnly() ? "" : undefined}
          data-required={rootState.required() ? "" : undefined}
          data-valid={rootState.valid() === true ? "" : undefined}
          data-invalid={rootState.valid() === false ? "" : undefined}
          data-touched={rootState.touched() ? "" : undefined}
          data-dirty={rootState.dirty() ? "" : undefined}
          data-filled={rootState.filled() ? "" : undefined}
          data-focused={rootState.focused() ? "" : undefined}
          data-validating={rootState.validating() ? "" : undefined}
          data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
          data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={setRef}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface RadioIndicatorState extends FieldRootState {
  /**
   * Whether the radio button is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly: boolean;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface RadioIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the radio button is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type RadioIndicatorProps<T extends JSX.ElementType = "span"> = RadioIndicatorOwnProps &
  RebaseUIComponentProps<T, RadioIndicatorState>;

export namespace RadioIndicator {
  export type State = RadioIndicatorState;
  export type Props<T extends JSX.ElementType = "span"> = RadioIndicatorProps<T>;
  export type OwnProps = RadioIndicatorOwnProps;
}

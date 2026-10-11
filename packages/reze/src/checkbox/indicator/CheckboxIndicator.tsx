import { dynamicElement, omitProps, store, type JSX } from "reze-js";

import { getFieldStateSnapshot } from "../../internals/field-constants";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { CheckboxRootState } from "../root/CheckboxRoot";
import { useCheckboxRootContext } from "../root/CheckboxRootContext";

/**
 * Indicates whether the checkbox is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Checkbox](https://rebase-ui.knst.dev/components/checkbox)
 */
export function CheckboxIndicator<T extends JSX.ElementType = "span">(props: CheckboxIndicator.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const rootState = useCheckboxRootContext();

  const rendered = () => rootState.checked() || rootState.indeterminate();

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

  function shouldRender(): boolean {
    return props.keepMounted === true || transition.mounted;
  }

  function snapshot(): CheckboxIndicatorState {
    return {
      ...getFieldStateSnapshot(rootState),
      checked: rootState.checked(),
      readOnly: rootState.readOnly(),
      required: rootState.required(),
      indeterminate: rootState.indeterminate(),
      transitionStatus: transition.transitionStatus,
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  return (
    <>
      {shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          data-checked={!rootState.indeterminate() && rootState.checked() ? "" : undefined}
          data-unchecked={!rootState.indeterminate() && !rootState.checked() ? "" : undefined}
          data-indeterminate={rootState.indeterminate() ? "" : undefined}
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
          ref={mergeRefs((element: HTMLElement | null) => {
            indicatorElement = element;
          }, props.ref as ((element: HTMLElement | null) => void) | undefined)}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface CheckboxIndicatorState extends CheckboxRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CheckboxIndicatorOwnProps {
  /**
   * Whether to keep the element in the DOM when the checkbox is not ticked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type CheckboxIndicatorProps<T extends JSX.ElementType = "span"> = CheckboxIndicatorOwnProps &
  RebaseUIComponentProps<T, CheckboxIndicatorState>;

export namespace CheckboxIndicator {
  export type State = CheckboxIndicatorState;
  export type Props<T extends JSX.ElementType = "span"> = CheckboxIndicatorProps<T>;
  export type OwnProps = CheckboxIndicatorOwnProps;
}

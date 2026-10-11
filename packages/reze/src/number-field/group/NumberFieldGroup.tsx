import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { getNumberFieldStateSnapshot, type NumberFieldRootState } from "../root/NumberFieldRoot";
import { useNumberFieldRootContext } from "../root/NumberFieldRootContext";

/**
 * Groups the input with the increment and decrement buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Number Field](https://rebase-ui.knst.dev/components/number-field)
 */
export function NumberFieldGroup<T extends JSX.ElementType = "div">(props: NumberFieldGroup.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { state } = useNumberFieldRootContext();

  function snapshot(): NumberFieldGroupState {
    return getNumberFieldStateSnapshot(state);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="group"
      data-disabled={state.disabled() ? "" : undefined}
      data-readonly={state.readOnly() ? "" : undefined}
      data-required={state.required() ? "" : undefined}
      data-scrubbing={state.scrubbing() ? "" : undefined}
      data-valid={state.valid() === true ? "" : undefined}
      data-invalid={state.valid() === false ? "" : undefined}
      data-touched={state.touched() ? "" : undefined}
      data-dirty={state.dirty() ? "" : undefined}
      data-filled={state.filled() ? "" : undefined}
      data-focused={state.focused() ? "" : undefined}
      data-validating={state.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface NumberFieldGroupState extends NumberFieldRootState {}

export type NumberFieldGroupProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, NumberFieldGroupState>;

export namespace NumberFieldGroup {
  export type State = NumberFieldGroupState;
  export type Props<T extends JSX.ElementType = "div"> = NumberFieldGroupProps<T>;
}

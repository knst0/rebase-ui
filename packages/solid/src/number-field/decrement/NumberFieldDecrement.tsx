import type { ValidComponent } from "@solidjs/web";

import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { NumberFieldRootState } from "../root/NumberFieldRoot";
import { useNumberFieldStepperButton } from "../root/useNumberFieldStepperButton";

/**
 * A stepper button that decreases the field value when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Number Field](https://rebase-ui.knst.dev/components/number-field)
 */
export function NumberFieldDecrement<T extends ValidComponent = "button">(props: NumberFieldDecrement.Props<T>) {
  return useNumberFieldStepperButton(props, false);
}

export interface NumberFieldDecrementState extends NumberFieldRootState {}

export type NumberFieldDecrementProps<T extends ValidComponent = "button"> = NativeButtonProps &
  RebaseUIComponentProps<T, NumberFieldDecrementState>;

export namespace NumberFieldDecrement {
  export type State = NumberFieldDecrementState;
  export type Props<T extends ValidComponent = "button"> = NumberFieldDecrementProps<T>;
}

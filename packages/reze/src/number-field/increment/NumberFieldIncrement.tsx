import type { JSX } from "reze-js";

import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { NumberFieldRootState } from "../root/NumberFieldRoot";
import { useNumberFieldStepperButton } from "../root/useNumberFieldStepperButton";

/**
 * A stepper button that increases the field value when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Number Field](https://rebase-ui.knst.dev/components/number-field)
 */
export function NumberFieldIncrement<T extends JSX.ElementType = "button">(props: NumberFieldIncrement.Props<T>) {
  return useNumberFieldStepperButton(props, true);
}

export interface NumberFieldIncrementState extends NumberFieldRootState {}

export type NumberFieldIncrementProps<T extends JSX.ElementType = "button"> = NativeButtonProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, NumberFieldIncrementState>;

export namespace NumberFieldIncrement {
  export type State = NumberFieldIncrementState;
  export type Props<T extends JSX.ElementType = "button"> = NumberFieldIncrementProps<T>;
}

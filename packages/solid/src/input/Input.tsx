import type { ComponentProps, ValidComponent } from "@solidjs/web";

import type { RebaseUIComponentProps } from "../internals/types";
import { FieldControl, type FieldControlState } from "../field/control/FieldControl";

/**
 * A native input element that automatically works with [Field](https://rebase-ui.knst.dev/components/field).
 * Renders an `<input>` element.
 *
 * Documentation: [Rebase UI Input](https://rebase-ui.knst.dev/components/input)
 */
export function Input<T extends ValidComponent = "input">(props: Input.Props<T>) {
  return <FieldControl {...(props as FieldControl.Props<T>)} />;
}

export interface InputState extends FieldControlState {}

export interface InputOwnProps {
  /**
   * Callback fired when the `value` changes. Use when controlled.
   */
  onValueChange?: ((value: string, eventDetails: Input.ChangeEventDetails) => void) | undefined;
  /**
   * The default value of the input. Use when uncontrolled.
   */
  defaultValue?: FieldControl.Props["defaultValue"] | undefined;
  /**
   * The value of the input. Use when controlled.
   */
  value?: ComponentProps<"input">["value"] | undefined;
}

export type InputProps<T extends ValidComponent = "input"> = InputOwnProps & RebaseUIComponentProps<T, InputState>;

export type InputChangeEventReason = FieldControl.ChangeEventReason;

export type InputChangeEventDetails = FieldControl.ChangeEventDetails;

export namespace Input {
  export type Props<T extends ValidComponent = "input"> = InputProps<T>;
  export type State = InputState;
  export type OwnProps = InputOwnProps;
  export type ChangeEventReason = InputChangeEventReason;
  export type ChangeEventDetails = InputChangeEventDetails;
}

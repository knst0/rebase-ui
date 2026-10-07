import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, untrack } from "solid-js";

import { createButton } from "../internals/create-button";
import { RenderElement } from "../internals/render-element";
import { split } from "../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../internals/types";

export function Button<T extends ValidComponent = "button">(props: Button.Props<T>) {
  const [local, elementProps] = split(props as Button.Props, { default: defaultProps }, [
    "as",
    "disabled",
    "nativeButton",
    "focusableWhenDisabled",
  ]);

  const as = untrack(() => local.as);

  const disabled = createMemo(() => local.disabled === true);

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: () => local.focusableWhenDisabled,
    native: () => local.nativeButton ?? true,
  });

  const state: ButtonState = { disabled };

  return <RenderElement as={as} state={state} props={[elementProps, getButtonProps, { ref: buttonRef }]} />;
}

const defaultProps = Object.freeze({
  as: "button",
} satisfies Partial<Button.Props>);

export interface ButtonState {
  /**
   * Whether the button should ignore user interaction.
   */
  disabled: Accessor<boolean>;
}

export interface ButtonOwnProps extends NativeButtonProps {
  disabled?: boolean | undefined;
  /**
   * Whether the button should be focusable when disabled.
   * @default false
   */
  focusableWhenDisabled?: boolean;
}

export type ButtonProps<T extends ValidComponent = "button"> = ButtonOwnProps & RebaseUIComponentProps<T, ButtonState>;

export namespace Button {
  export type Props<T extends ValidComponent = "button"> = ButtonProps<T>;
  export type OwnProps = ButtonOwnProps;
  export type State = ButtonState;
}

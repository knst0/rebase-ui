import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createButton } from "../internals/create-button";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../internals/types";

export function Button<T extends JSX.ElementType = "button">(props: Button.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "focusableWhenDisabled", "nativeButton", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const button = createButton(props);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      type={props.type ?? button.type}
      role={button.role}
      bool:disabled={button.disabled}
      tabindex={button.tabIndex}
      aria-disabled={button.ariaDisabled}
      data-disabled={props.disabled === true ? "" : undefined}
      class={resolveClassValue(props.class, { disabled: props.disabled === true })}
      style={resolveStyleValue(props.style, { disabled: props.disabled === true })}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      ref={button.buttonRef}
    >
      {resolveChildrenValue(children, () => ({ disabled: props.disabled === true }))}
    </Tag>
  );
}

export interface ButtonState {
  /**
   * Whether the button should ignore user interaction.
   */
  disabled: boolean;
}

export interface ButtonOwnProps extends NativeButtonProps {
  disabled?: boolean | undefined;
  /**
   * Whether the button should be focusable when disabled.
   * @default false
   */
  focusableWhenDisabled?: boolean;
}

export type ButtonProps<T extends JSX.ElementType = "button"> = ButtonOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ButtonState>;

export namespace Button {
  export type Props<T extends JSX.ElementType = "button"> = ButtonProps<T>;
  export type OwnProps = ButtonOwnProps;
  export type State = ButtonState;
}

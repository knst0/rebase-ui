import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { useClosePartRegistration } from "../../internals/popups/closePart";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { usePopoverRootContext } from "../root/PopoverRootContext";

/**
 * A button that closes the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverClose<T extends JSX.ElementType = "button">(props: PopoverClose.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "nativeButton", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = usePopoverRootContext();
  useClosePartRegistration();

  function handleClick(event: MouseEvent) {
    store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
  }

  const button = createButton({
    get disabled() {
      return props.disabled;
    },
    get focusableWhenDisabled() {
      return false;
    },
    get nativeButton() {
      return props.nativeButton;
    },
    get ref() {
      return props.ref;
    },
    // A custom onClick replaces the close logic, mirroring the Solid layer order
    // where element props overwrite the internal close props.
    get onClick() {
      return props.onClick ?? handleClick;
    },
    get onMouseDown() {
      return props.onMouseDown;
    },
    get onKeyDown() {
      return props.onKeyDown;
    },
    get onKeyUp() {
      return props.onKeyUp;
    },
    get onPointerDown() {
      return props.onPointerDown;
    },
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      type={button.type}
      role={button.role}
      bool:disabled={button.disabled}
      tabindex={button.tabIndex}
      aria-disabled={button.ariaDisabled}
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      ref={button.buttonRef}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

export interface PopoverCloseOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type PopoverCloseProps<T extends JSX.ElementType = "button"> = PopoverCloseOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, PopoverCloseState>;

export interface PopoverCloseState {}

export namespace PopoverClose {
  export type State = PopoverCloseState;
  export type Props<T extends JSX.ElementType = "button"> = PopoverCloseProps<T>;
  export type OwnProps = PopoverCloseOwnProps;
}

import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useDialogRootContext } from "../root/DialogRootContext";

/**
 * A button that closes the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogClose<T extends JSX.ElementType = "button">(props: DialogClose.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "nativeButton", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const dialog = useDialogRootContext();

  function handleClick(event: MouseEvent) {
    if (dialog.open()) {
      dialog.setOpen(false, createChangeEventDetails(REASONS.closePress, event, dialog.activeTriggerElement() ?? undefined));
    }
  }

  const button = createButton({
    get disabled() {
      return props.disabled;
    },
    get focusableWhenDisabled() {
      return true;
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
      data-disabled={props.disabled === true ? "" : undefined}
      class={resolveClassValue(props.class, { disabled: props.disabled ?? false })}
      style={resolveStyleValue(props.style, { disabled: props.disabled ?? false })}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      ref={button.buttonRef}
    >
      {resolveChildrenValue(children, () => ({ disabled: props.disabled ?? false }))}
    </Tag>
  );
}

export interface DialogCloseOwnProps extends NativeButtonProps {
  disabled?: boolean | undefined;
}

export type DialogCloseProps<T extends JSX.ElementType = "button"> = DialogCloseOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, DialogCloseState>;

export interface DialogCloseState {
  /**
   * Whether the button should ignore user interaction.
   */
  disabled: boolean;
}

export namespace DialogClose {
  export type State = DialogCloseState;
  export type Props<T extends JSX.ElementType = "button"> = DialogCloseProps<T>;
  export type OwnProps = DialogCloseOwnProps;
}

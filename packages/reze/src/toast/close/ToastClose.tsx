import { dynamicElement, omitProps, store, untrack, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useToastProviderContext } from "../provider/ToastProviderContext";
import { useToastRootContext } from "../root/ToastRootContext";

/**
 * Closes the toast when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastClose<T extends JSX.ElementType = "button">(props: ToastClose.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "nativeButton", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const toastStore = useToastProviderContext();
  const { toast, expanded } = useToastRootContext();

  const closeState = store({ hasFocus: false });

  function setHasFocus(next: boolean) {
    // One-shot write: the focus flag only steers the aria-hidden binding.
    untrack(() => {
      if (closeState.hasFocus !== next) {
        closeState.hasFocus = next;
      }
    });
  }

  function handleClose() {
    toastStore.closeToast(toast().id);
  }

  function handleFocus() {
    setHasFocus(true);
  }

  function handleBlur() {
    setHasFocus(false);
  }

  const button = createButton({
    get disabled() {
      return props.disabled;
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
      return props.onClick ?? handleClose;
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

  function snapshot(): ToastCloseState {
    return { type: toast().type };
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts. The default path renders a static `<button>` so toast
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <button
        {...(rest as Record<string, unknown>)}
        type={button.type}
        role={button.role}
        bool:disabled={button.disabled}
        tabindex={button.tabIndex}
        aria-disabled={button.ariaDisabled}
        aria-hidden={!expanded() && !closeState.hasFocus ? ("true" as const) : undefined}
        onFocus={props.onFocus ?? handleFocus}
        onBlur={props.onBlur ?? handleBlur}
        data-disabled={props.disabled === true ? "" : undefined}
        data-type={toast().type ?? undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onClick={button.onClick}
        onMouseDown={button.onMouseDown}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        ref={button.buttonRef}
      >
        {resolveChildrenValue(children, snapshot)}
      </button>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      type={button.type}
      role={button.role}
      bool:disabled={button.disabled}
      tabindex={button.tabIndex}
      aria-disabled={button.ariaDisabled}
      aria-hidden={!expanded() && !closeState.hasFocus ? ("true" as const) : undefined}
      onFocus={props.onFocus ?? handleFocus}
      onBlur={props.onBlur ?? handleBlur}
      data-disabled={props.disabled === true ? "" : undefined}
      data-type={toast().type ?? undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      ref={button.buttonRef}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface ToastCloseState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastCloseOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type ToastCloseProps<T extends JSX.ElementType = "button"> = ToastCloseOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ToastCloseState>;

export namespace ToastClose {
  export type State = ToastCloseState;
  export type Props<T extends JSX.ElementType = "button"> = ToastCloseProps<T>;
  export type OwnProps = ToastCloseOwnProps;
}

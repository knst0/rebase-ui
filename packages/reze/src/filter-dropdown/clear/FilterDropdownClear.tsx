import { dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useFilterDropdownRootContext, useFilterDropdownValueContext } from "../root/FilterDropdownRootContext";

/**
 * @internal
 */
export function FilterDropdownClear<T extends JSX.ElementType = "button">(props: FilterDropdownClear.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "disabled",
    "nativeButton",
    "onClick",
    "onMouseDown",
    "onKeyDown",
    "onKeyUp",
    "onPointerDown",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const context = useFilterDropdownRootContext();
  const value = useFilterDropdownValueContext();

  // One-shot read (matching the Solid layer, where it is untracked).
  const nativeButton = props.nativeButton ?? true;

  function disabled(): boolean {
    return context.disabled() || props.disabled === true;
  }

  function visible(): boolean {
    return value() !== "";
  }

  // `visible` is deliberately absent from the state: the component renders nothing when it is
  // false, so a `data-visible` attribute would be present on every rendered instance.
  function snapshot(): FilterDropdownClearState {
    return { disabled: disabled() };
  }

  // Live view of the consumer handlers omitted from the spread above.
  const userHandlers = props as unknown as {
    onClick?: ((event: MouseEvent) => void) | undefined;
    onMouseDown?: ((event: MouseEvent) => void) | undefined;
    onKeyDown?: ((event: KeyboardEvent) => void) | undefined;
    onKeyUp?: ((event: KeyboardEvent) => void) | undefined;
    onPointerDown?: ((event: PointerEvent) => void) | undefined;
  };

  function handleClick(event: MouseEvent): void {
    userHandlers.onClick?.(event);
    const eventDetails = createChangeEventDetails(REASONS.clearPress, event);
    untrack(() => context.onValueChange("", eventDetails));
    context.focusOwnerRef.current?.focus({ preventScroll: true });
  }

  function handleMouseDown(event: MouseEvent): void {
    userHandlers.onMouseDown?.(event);
    // Avoid stealing focus from the input on pointer interaction.
    event.preventDefault();
  }

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get nativeButton() {
      return nativeButton;
    },
    get onClick() {
      return handleClick;
    },
    get onMouseDown() {
      return handleMouseDown;
    },
    get onKeyDown() {
      return userHandlers.onKeyDown;
    },
    get onKeyUp() {
      return userHandlers.onKeyUp;
    },
    get onPointerDown() {
      return userHandlers.onPointerDown;
    },
    get ref() {
      return props.ref;
    },
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  return (
    <>
      {visible() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          type={button.type}
          role={button.role}
          bool:disabled={button.disabled}
          tabindex={-1}
          aria-disabled={button.ariaDisabled}
          aria-hidden="true"
          data-disabled={disabled() ? "" : undefined}
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
      )}
    </>
  );
}

export interface FilterDropdownClearState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FilterDropdownClearOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type FilterDropdownClearProps<T extends JSX.ElementType = "button"> = FilterDropdownClearOwnProps &
  RebaseUIComponentProps<T, FilterDropdownClearState>;

export namespace FilterDropdownClear {
  export type Props<T extends JSX.ElementType = "button"> = FilterDropdownClearProps<T>;
  export type State = FilterDropdownClearState;
}

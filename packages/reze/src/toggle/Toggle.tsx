import { dynamicElement, omitProps, type JSX } from "reze-js";

import { useCompositeItem } from "../internals/composite";
import { createButton } from "../internals/create-button";
import { createControllableSignal } from "../internals/createControllableSignal";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../internals/event-details";
import { makeEventPreventable } from "../internals/makeEventPreventable";
import { mergeRefs } from "../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../internals/renderProps";
import type {
  ButtonEventHandlers,
  NativeButtonProps,
  RebaseUIComponentProps,
} from "../internals/types";
import { useToggleGroupContext } from "../toggle-group/ToggleGroupContext";
import type { RebaseUIEvent } from "../types";

/**
 * A two-state button that can be on or off.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Toggle](https://rebase-ui.knst.dev/components/toggle)
 */
export function Toggle<Value extends string = string, T extends JSX.ElementType = "button">(props: Toggle.Props<Value, T>) {
  const rest = omitProps(
    props,
    "as",
    "defaultPressed",
    "disabled",
    "form", // never participates in form validation
    "nativeButton",
    "onPressedChange",
    "pressed",
    "type", // cannot change button type
    "value",
    "onClick",
    "onMouseDown",
    "onKeyUp",
    "onKeyDown",
    "onPointerDown",
    "onFocus",
    "onMouseMove",
    "tabindex",
    "tabIndex",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  // One-shot read (matching the Solid layer, where it is untracked).
  const nativeButton = props.nativeButton ?? true;

  const groupContext = useToggleGroupContext();

  function value(): string {
    return (props.value as string | undefined) ?? "";
  }

  function disabled(): boolean {
    return props.disabled === true || groupContext?.disabled() === true;
  }

  const [pressed, setPressedState] = createControllableSignal({
    value: () => (groupContext && value() ? groupContext.value().indexOf(value()) > -1 : props.pressed),
    defaultValue: () => (groupContext ? undefined : (props.defaultPressed ?? false)),
  });

  function isPressed(): boolean {
    return pressed() ?? false;
  }

  const composite = useCompositeItem({
    metadata: () => ({
      get disabled() {
        return disabled();
      },
    }),
  });

  function handleClick(event: MouseEvent): void {
    makeEventPreventable(event as RebaseUIEvent<MouseEvent>);
    (props.onClick as unknown as ((event: MouseEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<MouseEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    const nextPressed = !isPressed();
    const details = createChangeEventDetails(REASONS.none, event);

    // The group handler runs before the consumer callback.
    groupContext?.setGroupValue(value(), nextPressed, details);
    props.onPressedChange?.(nextPressed, details);

    if (details.isCanceled) {
      return;
    }

    setPressedState(nextPressed);
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

  // Live external props: getters keep the merged handlers reactive to prop changes.
  const externalProps: Record<string, any> = {};
  Object.defineProperty(externalProps, "onFocus", {
    enumerable: true,
    configurable: true,
    get: () => props.onFocus,
  });
  Object.defineProperty(externalProps, "onMouseMove", {
    enumerable: true,
    configurable: true,
    get: () => props.onMouseMove,
  });
  const merged = composite?.getCompositeProps(externalProps);

  const ref = mergeRefs(
    button.buttonRef,
    composite?.compositeRef,
    props.ref as ((element: HTMLElement | null) => void) | undefined,
  );

  function snapshot(): ToggleState {
    return { pressed: isPressed(), disabled: disabled() };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // toggle's focus and unregister it from the group. The default path renders a static
  // `<button>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <button
        {...(rest as Record<string, unknown>)}
        type={button.type}
        aria-pressed={isPressed() ? "true" : "false"}
        bool:disabled={button.disabled}
        tabindex={merged?.tabIndex ?? button.tabIndex}
        aria-disabled={button.ariaDisabled}
        data-pressed={isPressed() ? "" : undefined}
        data-disabled={disabled() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onClick={button.onClick}
        onMouseDown={button.onMouseDown}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        onFocus={merged?.onFocus ?? props.onFocus}
        onMouseMove={merged?.onMouseMove ?? props.onMouseMove}
        ref={ref}
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
      aria-pressed={isPressed() ? "true" : "false"}
      bool:disabled={button.disabled}
      tabindex={merged?.tabIndex ?? button.tabIndex}
      aria-disabled={button.ariaDisabled}
      data-pressed={isPressed() ? "" : undefined}
      data-disabled={disabled() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      onFocus={merged?.onFocus ?? props.onFocus}
      onMouseMove={merged?.onMouseMove ?? props.onMouseMove}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface ToggleState {
  /**
   * Whether the toggle is currently pressed.
   */
  pressed: boolean;
  /**
   * Whether the toggle should ignore user interaction.
   */
  disabled: boolean;
}

export interface ToggleOwnProps<Value extends string = string> extends NativeButtonProps {
  /**
   * Whether the toggle button is currently pressed.
   * This is the controlled counterpart of `defaultPressed`.
   */
  pressed?: boolean | undefined;
  /**
   * Whether the toggle button is initially pressed.
   * This is the uncontrolled counterpart of `pressed`.
   * @default false
   */
  defaultPressed?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Callback fired when the pressed state is changed.
   */
  onPressedChange?: ((pressed: boolean, eventDetails: Toggle.ChangeEventDetails) => void) | undefined;
  /**
   * A unique string that identifies the toggle when used
   * inside a toggle group.
   */
  value?: Value | undefined;
}

export type ToggleProps<Value extends string = string, T extends JSX.ElementType = "button"> = ToggleOwnProps<Value> &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ToggleState>;

export type ToggleChangeEventReason = typeof REASONS.none;
export type ToggleChangeEventDetails = RebaseUIChangeEventDetails<ToggleChangeEventReason>;

export namespace Toggle {
  export type State = ToggleState;
  export type Props<Value extends string = string, T extends JSX.ElementType = "button"> = ToggleProps<Value, T>;
  export type OwnProps<Value extends string = string> = ToggleOwnProps<Value>;
  export type ChangeEventReason = ToggleChangeEventReason;
  export type ChangeEventDetails = ToggleChangeEventDetails;
}

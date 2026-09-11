import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, untrack } from "solid-js";

import { useCompositeItem } from "../internals/composite";
import { createButton } from "../internals/create-button";
import { createControllableSignal } from "../internals/createControllableSignal";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../internals/event-details";
import { makeEventPreventable } from "../internals/makeEventPreventable";
import { mergeRefs } from "../internals/mergeRefs";
import { RenderElement } from "../internals/render-element";
import { split } from "../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../internals/types";
import { useToggleGroupContext } from "../toggle-group/ToggleGroupContext";

/**
 * A two-state button that can be on or off.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Toggle](https://rebase-ui.knst.dev/components/toggle)
 */
export function Toggle<Value extends string = string, T extends ValidComponent = "button">(props: Toggle.Props<Value, T>) {
  const [local, elementProps] = split(props as Toggle.Props<Value>, { default: defaultProps }, [
    "as",
    "defaultPressed",
    "disabled",
    "form", // never participates in form validation
    "nativeButton",
    "onPressedChange",
    "pressed",
    "type", // cannot change button type
    "value",
  ]);

  const as = untrack(() => local.as);
  const nativeButton = untrack(() => local.nativeButton);

  const value = () => local.value ?? "";

  const groupContext = useToggleGroupContext();

  const disabled = createMemo(() => local.disabled || groupContext?.disabled() || false);

  const [pressed, setPressedState] = createControllableSignal({
    value: () => (groupContext && value() ? groupContext.value().indexOf(value()) > -1 : local.pressed),
    defaultValue: () => (groupContext ? undefined : local.defaultPressed),
  });

  const isPressed = createMemo(() => pressed() ?? false);

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: nativeButton,
  });

  const composite = useCompositeItem({
    metadata: () => ({
      get disabled() {
        return disabled();
      },
    }),
  });

  const ref = composite === undefined ? buttonRef : mergeRefs(buttonRef, composite.compositeRef);

  const state: ToggleState = { disabled, pressed: isPressed };

  const toggleProps = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onClick") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    target.onClick = (event: MouseEvent) => {
      makeEventPreventable(event as any);
      externalProps.onClick?.(event);
      if ((event as any).rebaseUIHandlerPrevented) {
        return;
      }

      const nextPressed = !isPressed();
      const details = createChangeEventDetails(REASONS.none, event);

      // The group handler runs before the consumer callback.
      groupContext?.setGroupValue(value(), nextPressed, details);
      local.onPressedChange?.(nextPressed, details);

      if (details.isCanceled) {
        return;
      }

      setPressedState(nextPressed);
    };

    return target;
  };

  const ariaProps = {
    get "aria-pressed"() {
      return isPressed() ? "true" : "false";
    },
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[ariaProps, elementProps, toggleProps, getButtonProps, composite?.getCompositeProps, { ref }]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "button",
  defaultPressed: false,
  disabled: false,
} satisfies Partial<Toggle.Props>);

export interface ToggleState {
  /**
   * Whether the toggle is currently pressed.
   */
  pressed: Accessor<boolean>;
  /**
   * Whether the toggle should ignore user interaction.
   */
  disabled: Accessor<boolean>;
}

export interface ToggleOwnProps<Value extends string = string> extends NativeButtonProps {
  /**
   * Whether the toggle button is currently pressed.
   * This is the controlled counterpart of `defaultPressed`.
   */
  pressed?: boolean | undefined;
  /**
   * Whether the toggle button is currently pressed.
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

export type ToggleProps<Value extends string = string, T extends ValidComponent = "button"> = ToggleOwnProps<Value> &
  RebaseUIComponentProps<T, ToggleState>;

export type ToggleChangeEventReason = typeof REASONS.none;
export type ToggleChangeEventDetails = RebaseUIChangeEventDetails<ToggleChangeEventReason>;

export namespace Toggle {
  export type State = ToggleState;
  export type Props<Value extends string = string, T extends ValidComponent = "button"> = ToggleProps<Value, T>;
  export type OwnProps<Value extends string = string> = ToggleOwnProps<Value>;
  export type ChangeEventReason = ToggleChangeEventReason;
  export type ChangeEventDetails = ToggleChangeEventDetails;
}

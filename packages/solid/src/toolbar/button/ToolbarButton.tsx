import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, untrack } from "solid-js";

import { CompositeItem } from "../../internals/composite";
import { createButton } from "../../internals/create-button";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useToolbarGroupContext } from "../group/ToolbarGroupContext";
import type { ToolbarRootState } from "../root/ToolbarRoot";
import { useToolbarRootContext } from "../root/ToolbarRootContext";

/**
 * A button that can be used as-is or as a trigger for other components.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarButton<T extends ValidComponent = "button">(props: ToolbarButton.Props<T>) {
  const [local, elementProps] = split(props as ToolbarButton.Props, { default: defaultProps }, [
    "as",
    "disabled",
    "focusableWhenDisabled",
    "nativeButton",
  ]);

  const as = untrack(() => local.as);
  const nativeButton = untrack(() => local.nativeButton);

  const { disabled: toolbarDisabled, orientation } = useToolbarRootContext();

  const groupContext = useToolbarGroupContext();

  const disabled = createMemo(() => toolbarDisabled() || (groupContext?.disabled() ?? false) || local.disabled);
  const focusableWhenDisabled = () => local.focusableWhenDisabled;

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled,
    native: nativeButton,
  });

  const state: ToolbarButtonState = { disabled, focusable: focusableWhenDisabled, orientation };

  // When `as` is customized (typically another Rebase UI component like Menu.Trigger), forward
  // `disabled` so the rendered component can derive its own disabled state. For the default
  // toolbar button, avoid forwarding it so focusable disabled buttons remain hoverable for
  // interactions like tooltips.
  const forwardedDisabled =
    as === "button"
      ? undefined
      : {
          get disabled() {
            return disabled();
          },
        };

  return (
    <CompositeItem
      as={as}
      state={state}
      metadata={{
        get disabled() {
          return disabled();
        },
        get focusableWhenDisabled() {
          return focusableWhenDisabled();
        },
      }}
      ref={buttonRef}
      props={[elementProps, forwardedDisabled, getButtonProps]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "button",
  disabled: false,
  focusableWhenDisabled: true,
} satisfies Partial<ToolbarButton.Props>);

export interface ToolbarButtonState extends ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: Accessor<boolean>;
}

export interface ToolbarButtonOwnProps extends NativeButtonProps {
  /**
   * When `true` the item is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When `true` the item remains focusable when disabled.
   * @default true
   */
  focusableWhenDisabled?: boolean | undefined;
}

export type ToolbarButtonProps<T extends ValidComponent = "button"> = ToolbarButtonOwnProps & RebaseUIComponentProps<T, ToolbarButtonState>;

export namespace ToolbarButton {
  export type State = ToolbarButtonState;
  export type Props<T extends ValidComponent = "button"> = ToolbarButtonProps<T>;
  export type OwnProps = ToolbarButtonOwnProps;
}

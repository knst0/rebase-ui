import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, untrack } from "solid-js";

import { CompositeItem } from "../../internals/composite";
import { createFocusableWhenDisabledProps } from "../../internals/createFocusableWhenDisabledProps";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useToolbarGroupContext } from "../group/ToolbarGroupContext";
import type { ToolbarRootState } from "../root/ToolbarRoot";
import { useToolbarRootContext } from "../root/ToolbarRootContext";

/**
 * A native input element that integrates with Toolbar keyboard navigation.
 * Renders an `<input>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarInput<T extends ValidComponent = "input">(props: ToolbarInput.Props<T>) {
  const [local, elementProps] = split(props as ToolbarInput.Props, { default: defaultProps }, ["as", "disabled", "focusableWhenDisabled"]);

  const as = untrack(() => local.as);

  const { disabled: toolbarDisabled, orientation } = useToolbarRootContext();

  const groupContext = useToolbarGroupContext();

  const disabled = createMemo(() => toolbarDisabled() || (groupContext?.disabled() ?? false) || local.disabled);
  const focusableWhenDisabled = () => local.focusableWhenDisabled;

  const focusableWhenDisabledProps = createFocusableWhenDisabledProps({
    composite: () => true,
    disabled,
    focusableWhenDisabled,
    isNativeButton: () => false,
  });

  const state: ToolbarInputState = { disabled, focusable: focusableWhenDisabled, orientation };

  const preventWhenDisabled = (event: Event) => {
    if (disabled()) {
      event.preventDefault();
    }
  };

  const defaultElementProps = {
    onClick: preventWhenDisabled,
    onPointerDown: preventWhenDisabled,
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
      props={[defaultElementProps, elementProps, focusableWhenDisabledProps]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "input",
  disabled: false,
  focusableWhenDisabled: true,
} satisfies Partial<ToolbarInput.Props>);

export interface ToolbarInputState extends ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: Accessor<boolean>;
}

export interface ToolbarInputOwnProps {
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

export type ToolbarInputProps<T extends ValidComponent = "input"> = ToolbarInputOwnProps & RebaseUIComponentProps<T, ToolbarInputState>;

export namespace ToolbarInput {
  export type State = ToolbarInputState;
  export type Props<T extends ValidComponent = "input"> = ToolbarInputProps<T>;
  export type OwnProps = ToolbarInputOwnProps;
}

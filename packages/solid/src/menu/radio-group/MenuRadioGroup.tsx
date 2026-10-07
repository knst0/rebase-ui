import type { ValidComponent } from "@solidjs/web";
import { createSignal, untrack } from "solid-js";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import { stableCallback } from "../../internals/stableCallback";
import type { RebaseUIComponentProps } from "../../internals/types";
import { MenuGroupContext } from "../group/MenuGroupContext";
import type { MenuRoot } from "../root/MenuRoot";
import { MenuRadioGroupContext } from "./MenuRadioGroupContext";

/**
 * Groups related radio items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioGroup<T extends ValidComponent = "div">(props: MenuRadioGroup.Props<T>) {
  const [local, elementProps] = split(props as MenuRadioGroup.Props, { default: defaultProps }, [
    "as",
    "value",
    "defaultValue",
    "onValueChange",
    "disabled",
    "aria-labelledby",
  ]);

  const as = untrack(() => local.as);

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const [value, setValueUnwrapped] = createControllableSignal({
    value: () => local.value,
    defaultValue: () => local.defaultValue,
  });

  const onValueChange = stableCallback(() => local.onValueChange);

  function setValue(newValue: any, eventDetails: MenuRadioGroup.ChangeEventDetails) {
    onValueChange(newValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(newValue);
  }

  const state: MenuRadioGroupState = {
    get disabled() {
      return local.disabled;
    },
  };

  const groupProps = {
    role: "group" as const,
    get "aria-labelledby"() {
      return (local["aria-labelledby"] as string | undefined) ?? labelId();
    },
    get "aria-disabled"() {
      return local.disabled ? ("true" as const) : undefined;
    },
  };

  return (
    <MenuGroupContext value={{ labelId, setLabelId }}>
      <MenuRadioGroupContext
        value={{
          get value() {
            return value();
          },
          setValue,
          get disabled() {
            return local.disabled;
          },
        }}
      >
        <RenderElement as={as} state={state} props={[groupProps, elementProps]} />
      </MenuRadioGroupContext>
    </MenuGroupContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
} satisfies Partial<MenuRadioGroup.Props>);

export interface MenuRadioGroupState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
}

export interface MenuRadioGroupOwnProps {
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: any;
  /**
   * The uncontrolled value of the radio item that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: any;
  /**
   * Function called when the selected value changes.
   */
  onValueChange?: ((value: any, eventDetails: MenuRadioGroup.ChangeEventDetails) => void) | undefined;
  /**
   * Whether the component should ignore user interaction.
   *
   * @default false
   */
  disabled?: boolean | undefined;
}

export type MenuRadioGroupChangeEventReason = MenuRoot.ChangeEventReason;
export type MenuRadioGroupChangeEventDetails = MenuRoot.ChangeEventDetails;

export type MenuRadioGroupProps<T extends ValidComponent = "div"> = MenuRadioGroupOwnProps & RebaseUIComponentProps<T, MenuRadioGroupState>;

export namespace MenuRadioGroup {
  export type State = MenuRadioGroupState;
  export type Props<T extends ValidComponent = "div"> = MenuRadioGroupProps<T>;
  export type OwnProps = MenuRadioGroupOwnProps;
  export type ChangeEventReason = MenuRadioGroupChangeEventReason;
  export type ChangeEventDetails = MenuRadioGroupChangeEventDetails;
}

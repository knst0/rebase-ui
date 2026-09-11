import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, untrack } from "solid-js";

import { EMPTY_ARRAY } from "#utils/empty";

import { CompositeRoot } from "../internals/composite";
import { createControllableSignal } from "../internals/createControllableSignal";
import { REASONS, type RebaseUIChangeEventDetails } from "../internals/event-details";
import { split } from "../internals/split";
import type { Orientation, RebaseUIComponentProps } from "../internals/types";
import { ToggleGroupContext } from "./ToggleGroupContext";

/**
 * Provides a shared state to a series of toggle buttons.
 *
 * Documentation: [Rebase UI Toggle Group](https://rebase-ui.knst.dev/components/toggle-group)
 */
export function ToggleGroup<Value extends string = string, T extends ValidComponent = "div">(
  props: ToggleGroup.Props<Value, T>,
) {
  const [local, elementProps] = split(props as ToggleGroup.Props<Value>, { default: defaultProps }, [
    "as",
    "defaultValue",
    "disabled",
    "loopFocus",
    "multiple",
    "onValueChange",
    "orientation",
    "value",
  ]);

  const as = untrack(() => local.as);

  // Use the raw props to distinguish an omitted value from the empty default.
  const isValueInitialized = () => local.value !== undefined || local.defaultValue !== undefined;

  const disabled = createMemo(() => local.disabled);

  const [value, setValue] = createControllableSignal({
    value: () => local.value,
    defaultValue: () => local.defaultValue ?? (EMPTY_ARRAY as readonly Value[]),
  });

  const setGroupValue = (newValue: Value, nextPressed: boolean, eventDetails: RebaseUIChangeEventDetails<typeof REASONS.none>) => {
    const current = value();
    let next: Value[];

    if (local.multiple) {
      next = current.slice();
      if (nextPressed) {
        next.push(newValue);
      } else {
        next.splice(next.indexOf(newValue), 1);
      }
    } else {
      next = nextPressed ? [newValue] : [];
    }

    local.onValueChange?.(next, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValue(next);
  };

  const state: ToggleGroupState = {
    disabled,
    multiple: () => local.multiple,
    orientation: () => local.orientation,
  };

  const contextValue: ToggleGroupContext<Value> = {
    disabled,
    setGroupValue,
    value,
    isValueInitialized,
  };

  const groupProps = {
    role: "group",
  } as const;

  return (
    <ToggleGroupContext value={contextValue}>
      <CompositeRoot
        as={as}
        state={state}
        props={[groupProps, elementProps]}
        orientation={local.orientation}
        loopFocus={local.loopFocus}
        enableHomeAndEndKeys
      />
    </ToggleGroupContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
  loopFocus: true,
  multiple: false,
  orientation: "horizontal",
} satisfies Partial<ToggleGroup.Props>);

export interface ToggleGroupState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple: Accessor<boolean>;
  /**
   * The orientation of the toggle group.
   */
  orientation: Accessor<Orientation>;
}

export interface ToggleGroupOwnProps<Value extends string = string> {
  /**
   * The pressed state of the toggle group represented by an array of
   * the values of all pressed toggle buttons.
   * This is the controlled counterpart of `defaultValue`.
   */
  value?: readonly Value[] | undefined;
  /**
   * The pressed state of the toggle group represented by an array of
   * the values of all pressed toggle buttons.
   * This is the uncontrolled counterpart of `value`.
   */
  defaultValue?: readonly Value[] | undefined;
  /**
   * Callback fired when the pressed states of the toggle group changes.
   */
  onValueChange?: ((groupValue: Value[], eventDetails: ToggleGroup.ChangeEventDetails) => void) | undefined;
  /**
   * Whether the toggle group should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple?: boolean | undefined;
}

export type ToggleGroupProps<Value extends string = string, T extends ValidComponent = "div"> = ToggleGroupOwnProps<Value> &
  RebaseUIComponentProps<T, ToggleGroupState>;

export type ToggleGroupChangeEventReason = typeof REASONS.none;
export type ToggleGroupChangeEventDetails = RebaseUIChangeEventDetails<ToggleGroupChangeEventReason>;

export namespace ToggleGroup {
  export type State = ToggleGroupState;
  export type Props<Value extends string = string, T extends ValidComponent = "div"> = ToggleGroupProps<Value, T>;
  export type OwnProps<Value extends string = string> = ToggleGroupOwnProps<Value>;
  export type ChangeEventReason = ToggleGroupChangeEventReason;
  export type ChangeEventDetails = ToggleGroupChangeEventDetails;
}

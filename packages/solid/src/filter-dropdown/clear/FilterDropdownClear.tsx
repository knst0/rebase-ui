import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useFilterDropdownRootContext, useFilterDropdownValueContext } from "../root/FilterDropdownRootContext";

/**
 * @internal
 */
export function FilterDropdownClear<T extends ValidComponent = "button">(props: FilterDropdownClearProps<T>) {
  const [local, elementProps] = split(props as FilterDropdownClearProps, { default: defaultProps }, [
    "as",
    "disabled",
    "nativeButton",
    "ref",
  ]);

  const as = untrack(() => local.as);
  const context = useFilterDropdownRootContext();
  const value = useFilterDropdownValueContext();

  const disabled = () => context.disabled() || local.disabled;
  const visible = () => value() !== "";

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => local.nativeButton,
  });

  // `visible` is deliberately absent from the state: the component renders nothing when it is
  // false, so a `data-visible` attribute would be present on every rendered instance.
  const state: FilterDropdownClearState = {
    get disabled() {
      return disabled();
    },
  };

  const ref = mergeRefs<HTMLButtonElement | null>(buttonRef, local.ref as ((element: HTMLButtonElement | null) => void) | undefined);

  const clearProps: Record<string, unknown> = {
    tabIndex: -1,
    "aria-hidden": "true" as const,
    onMouseDown(event: MouseEvent) {
      // Avoid stealing focus from the input on pointer interaction.
      event.preventDefault();
    },
    onClick(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
      const eventDetails = createChangeEventDetails(REASONS.clearPress, event);
      untrack(() => context.onValueChange("", eventDetails));
      context.focusOwnerRef.current?.focus({ preventScroll: true });
    },
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[clearProps, elementProps, getButtonProps, { ref }]}
      enabled={visible}
      stateAttributesMapping={filterDropdownClearStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "button",
  disabled: false,
  nativeButton: true,
} satisfies Partial<FilterDropdownClearProps>);

const filterDropdownClearStateMapping = {
  disabled: {
    keys: ["data-disabled"],
    map: (value: boolean) => (value ? { "data-disabled": "" } : null),
  },
};

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

export type FilterDropdownClearProps<T extends ValidComponent = "button"> = FilterDropdownClearOwnProps &
  RebaseUIComponentProps<T, FilterDropdownClearState>;

export namespace FilterDropdownClear {
  export type Props<T extends ValidComponent = "button"> = FilterDropdownClearProps<T>;
  export type State = FilterDropdownClearState;
}

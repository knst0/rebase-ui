import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { CompositeListContext, createCompositeList } from "../../internals/composite";
import { createControllableSignal } from "../../internals/createControllableSignal";
import type { REASONS, RebaseUIChangeEventDetails } from "../../internals/event-details";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { AccordionRootContext } from "./AccordionRootContext";

/**
 * Groups all parts of the accordion.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/accordion)
 */
export function AccordionRoot<Value = any, T extends ValidComponent = "div">(props: AccordionRoot.Props<Value, T>) {
  const [local, elementProps] = split(props as AccordionRoot.Props, { default: defaultProps }, [
    "as",
    "defaultValue",
    "disabled",
    "hiddenUntilFound",
    "keepMounted",
    "multiple",
    "onValueChange",
    "value",
  ]);

  const as = untrack(() => local.as);
  const hiddenUntilFound = untrack(() => local.hiddenUntilFound);
  const keepMounted = untrack(() => local.keepMounted);

  if (process.env.NODE_ENV !== "production") {
    if (hiddenUntilFound && !keepMounted) {
      console.error(
        "Rebase UI: The `keepMounted={false}` prop on `Accordion.Root` is ignored when `hiddenUntilFound` is enabled, since panels must remain mounted while closed.",
      );
    }
  }

  const disabled = () => local.disabled;

  const [value, setValue] = createControllableSignal<AccordionValue<Value>>({
    value: () => local.value,
    defaultValue: () => local.defaultValue ?? [],
  });

  const handleValueChange = (newValue: AccordionValue<Value>[number], nextOpen: boolean, eventDetails: AccordionRootChangeEventDetails) => {
    let nextValue: AccordionValue<Value>;

    if (!local.multiple) {
      nextValue = (value()[0] === newValue ? [] : [newValue]) as AccordionValue<Value>;
    } else if (nextOpen) {
      nextValue = value().slice();
      nextValue.push(newValue);
    } else {
      nextValue = value().filter((v) => v !== newValue);
    }

    local.onValueChange?.(nextValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValue(nextValue);
  };

  const state: AccordionRootState<Value> = {
    value,
    disabled,
  };

  const contextValue: AccordionRootContext<Value> = {
    disabled,
    handleValueChange,
    hiddenUntilFound,
    keepMounted,
    state,
    value,
  };

  const accordionItems = createCompositeList();

  return (
    <CompositeListContext value={accordionItems.contextValue}>
      <AccordionRootContext value={contextValue}>
        <RenderElement
          as={as}
          state={state as AccordionRootState}
          props={[elementProps]}
          stateAttributesMapping={rootStateAttributesMapping}
        />
      </AccordionRootContext>
    </CompositeListContext>
  );
}

const rootStateAttributesMapping: StateAttributesMapping<AccordionRootState> = {
  value: { keys: [], map: () => null },
};

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
  multiple: false,
  hiddenUntilFound: false,
  keepMounted: false,
} satisfies Partial<AccordionRoot.Props>);

export type AccordionValue<Value = any> = Value[];

export interface AccordionRootState<Value = any> {
  /**
   * The current value.
   */
  value: Accessor<AccordionValue<Value>>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
}

export interface AccordionRootOwnProps<Value = any> {
  /**
   * The controlled value of the item(s) that should be expanded.
   *
   * To render an uncontrolled accordion, use the `defaultValue` prop instead.
   */
  value?: AccordionValue<Value> | undefined;
  /**
   * The uncontrolled value of the item(s) that should be initially expanded.
   *
   * To render a controlled accordion, use the `value` prop instead.
   */
  defaultValue?: AccordionValue<Value> | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Event handler called when an accordion item is expanded or collapsed.
   * Provides the new value as an argument.
   */
  onValueChange?: ((value: AccordionValue<Value>, eventDetails: AccordionRootChangeEventDetails) => void) | undefined;
  /**
   * Whether multiple items can be open at the same time.
   * @default false
   */
  multiple?: boolean | undefined;
}

export type AccordionRootProps<Value = any, T extends ValidComponent = "div"> = AccordionRootOwnProps<Value> &
  RebaseUIComponentProps<T, AccordionRootState<Value>>;

export type AccordionRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionRootChangeEventDetails = RebaseUIChangeEventDetails<AccordionRootChangeEventReason>;

export namespace AccordionRoot {
  export type Value<TValue = any> = AccordionValue<TValue>;
  export type State<TValue = any> = AccordionRootState<TValue>;
  export type Props<TValue = any, T extends ValidComponent = "div"> = AccordionRootProps<TValue, T>;
  export type OwnProps<TValue = any> = AccordionRootOwnProps<TValue>;
  export type ChangeEventReason = AccordionRootChangeEventReason;
  export type ChangeEventDetails = AccordionRootChangeEventDetails;
}

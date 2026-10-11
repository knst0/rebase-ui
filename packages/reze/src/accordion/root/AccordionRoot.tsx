import { dynamicElement, getOwner, omitProps, runWithOwner, type JSX } from "reze-js";

import { CompositeListContext, createCompositeList } from "../../internals/composite";
import { createControllableSignal } from "../../internals/createControllableSignal";
import { REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { stableCallback } from "../../internals/stableCallback";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { AccordionRootContext, useAccordionRootContext } from "./AccordionRootContext";

/**
 * Groups all parts of the accordion.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/accordion)
 */
export function AccordionRoot<Value = any, T extends JSX.ElementType = "div">(props: AccordionRoot.Props<Value, T>) {
  const rest = omitProps(
    props,
    "as",
    "defaultValue",
    "disabled",
    "hiddenUntilFound",
    "keepMounted",
    "multiple",
    "onValueChange",
    "value",
    "class",
    "style",
    "children",
    "ref",
  );

  const hiddenUntilFound = props.hiddenUntilFound ?? false;
  const keepMounted = props.keepMounted ?? false;

  if (process.env.NODE_ENV !== "production") {
    if (hiddenUntilFound && !keepMounted) {
      console.error(
        "Rebase UI: The `keepMounted={false}` prop on `Accordion.Root` is ignored when `hiddenUntilFound` is enabled, since panels must remain mounted while closed.",
      );
    }
  }

  function disabled(): boolean {
    return props.disabled ?? false;
  }

  const [value, setValue] = createControllableSignal<AccordionValue<Value>>({
    value: () => props.value,
    defaultValue: () => props.defaultValue ?? [],
  });

  const onValueChange = stableCallback(() => props.onValueChange);

  function handleValueChange(
    newValue: AccordionValue<Value>[number],
    nextOpen: boolean,
    eventDetails: AccordionRootChangeEventDetails,
  ): void {
    let nextValue: AccordionValue<Value>;

    if (!props.multiple) {
      nextValue = (value()[0] === newValue ? [] : [newValue]) as AccordionValue<Value>;
    } else if (nextOpen) {
      nextValue = value().slice();
      nextValue.push(newValue);
    } else {
      nextValue = value().filter((v) => v !== newValue);
    }

    onValueChange(nextValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValue(nextValue);
  }

  function snapshot(): AccordionRootState<Value> {
    return { value: value(), disabled: disabled() };
  }

  const contextValue: AccordionRootContext<Value> = {
    disabled,
    handleValueChange,
    hiddenUntilFound,
    keepMounted,
    state: { value, disabled },
    value,
  };

  const accordionItems = createCompositeList();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the root's listeners every time
  // a panel appears or disappears. The default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        data-disabled={disabled() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        <CompositeListContext value={accordionItems.contextValue}>
          <AccordionRootContext value={contextValue}>
            <AccordionRootContent>{props.children}</AccordionRootContent>
          </AccordionRootContext>
        </CompositeListContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-disabled={disabled() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <CompositeListContext value={accordionItems.contextValue}>
        <AccordionRootContext value={contextValue}>
          <AccordionRootContent>{props.children}</AccordionRootContent>
        </AccordionRootContext>
      </CompositeListContext>
    </Tag>
  );
}

/**
 * Resolves the root children inside the accordion context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function AccordionRootContent(props: { children: ChildrenValue<AccordionRootState> }) {
  const children = props.children;

  const { value, disabled } = useAccordionRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: AccordionRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the accordion context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: AccordionRootState = { value: value(), disabled: disabled() };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export type AccordionValue<Value = any> = Value[];

export interface AccordionRootState<Value = any> {
  /**
   * The current value.
   */
  value: AccordionValue<Value>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
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

export type AccordionRootProps<Value = any, T extends JSX.ElementType = "div"> = AccordionRootOwnProps<Value> &
  RebaseUIComponentProps<T, AccordionRootState<Value>>;

export type AccordionRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionRootChangeEventDetails = RebaseUIChangeEventDetails<AccordionRootChangeEventReason>;

export namespace AccordionRoot {
  export type Value<TValue = any> = AccordionValue<TValue>;
  export type State<TValue = any> = AccordionRootState<TValue>;
  export type Props<TValue = any, T extends JSX.ElementType = "div"> = AccordionRootProps<TValue, T>;
  export type OwnProps<TValue = any> = AccordionRootOwnProps<TValue>;
  export type ChangeEventReason = AccordionRootChangeEventReason;
  export type ChangeEventDetails = AccordionRootChangeEventDetails;
}

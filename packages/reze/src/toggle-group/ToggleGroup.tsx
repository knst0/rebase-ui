import { dynamicElement, getOwner, omitProps, runWithOwner, type JSX } from "reze-js";

import { CompositeRootContext, useCompositeRoot } from "../internals/composite";
import { createControllableSignal } from "../internals/createControllableSignal";
import { REASONS, type RebaseUIChangeEventDetails } from "../internals/event-details";
import { mergeRefs } from "../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../internals/renderProps";
import type { ChildrenValue, Orientation, RebaseUIComponentProps } from "../internals/types";
import { ToggleGroupContext, useToggleGroupContext } from "./ToggleGroupContext";

const EMPTY_ARRAY: readonly string[] = [];

/**
 * Provides a shared state to a series of toggle buttons.
 *
 * Documentation: [Rebase UI Toggle Group](https://rebase-ui.knst.dev/components/toggle-group)
 */
export function ToggleGroup<Value extends string = string, T extends JSX.ElementType = "div">(
  props: ToggleGroup.Props<Value, T>,
) {
  const rest = omitProps(
    props,
    "as",
    "defaultValue",
    "disabled",
    "loopFocus",
    "multiple",
    "onValueChange",
    "orientation",
    "value",
    "onKeyDown",
    "onFocus",
    "class",
    "style",
    "children",
    "ref",
  );

  function disabled(): boolean {
    return props.disabled === true;
  }

  function multiple(): boolean {
    return props.multiple === true;
  }

  function orientation(): Orientation {
    return props.orientation ?? "horizontal";
  }

  function loopFocus(): boolean {
    return props.loopFocus ?? true;
  }

  const [value, setValue] = createControllableSignal<readonly Value[]>({
    value: () => props.value,
    defaultValue: () => props.defaultValue ?? (EMPTY_ARRAY as readonly Value[]),
  });

  // Use the raw props to distinguish an omitted value from the empty default.
  function isValueInitialized(): boolean {
    return props.value !== undefined || props.defaultValue !== undefined;
  }

  function setGroupValue(nextValue: Value, nextPressed: boolean, eventDetails: ToggleGroup.ChangeEventDetails): void {
    const current = value();
    let next: Value[];

    if (multiple()) {
      next = current.slice() as Value[];
      if (nextPressed) {
        next.push(nextValue);
      } else {
        next.splice(next.indexOf(nextValue), 1);
      }
    } else {
      next = nextPressed ? [nextValue] : [];
    }

    props.onValueChange?.(next, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValue(next);
  }

  const { contextValue: compositeContext, getRootProps, rootRef } = useCompositeRoot({
    orientation: () => orientation(),
    loopFocus: () => loopFocus(),
    enableHomeAndEndKeys: true,
  });

  // Live external props: getters keep the merged handlers reactive to prop changes.
  const externalProps: Record<string, any> = {};
  Object.defineProperty(externalProps, "onKeyDown", {
    enumerable: true,
    configurable: true,
    get: () => props.onKeyDown,
  });
  Object.defineProperty(externalProps, "onFocus", {
    enumerable: true,
    configurable: true,
    get: () => props.onFocus,
  });
  const rootProps = getRootProps(externalProps);

  const contextValue: ToggleGroupContext<Value> = {
    disabled,
    setGroupValue,
    value,
    multiple,
    orientation,
    isValueInitialized,
  };

  function snapshot(): ToggleGroupState {
    return { disabled: disabled(), multiple: multiple(), orientation: orientation() };
  }

  const ref = mergeRefs(rootRef, props.ref as ((element: HTMLElement | null) => void) | undefined);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // toggles' focus and listeners. The default path renders a static `<div>`; only a
  // customized `as` keeps the dynamic tag. Keep both branches in sync.
  // The providers live inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the toggles without context. Children
  // resolve in ToggleGroupContent below so they are created inside the providers.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="group"
        data-disabled={disabled() ? "" : undefined}
        data-multiple={multiple() ? "" : undefined}
        data-orientation={orientation()}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onKeyDown={rootProps.onKeyDown}
        onFocus={rootProps.onFocus}
        ref={ref}
      >
        <ToggleGroupContext value={contextValue}>
          <CompositeRootContext value={compositeContext}>
            <ToggleGroupContent>{props.children}</ToggleGroupContent>
          </CompositeRootContext>
        </ToggleGroupContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="group"
      data-disabled={disabled() ? "" : undefined}
      data-multiple={multiple() ? "" : undefined}
      data-orientation={orientation()}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onKeyDown={rootProps.onKeyDown}
      onFocus={rootProps.onFocus}
      ref={ref}
    >
      <ToggleGroupContext value={contextValue}>
        <CompositeRootContext value={compositeContext}>
          <ToggleGroupContent>{props.children}</ToggleGroupContent>
        </CompositeRootContext>
      </ToggleGroupContext>
    </Tag>
  );
}

/**
 * Resolves the group children inside the toggle group context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the group state changes, matching the Solid layer where the
 * children memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function ToggleGroupContent(props: { children: ChildrenValue<ToggleGroupState> }) {
  const children = props.children;

  const group = useToggleGroupContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: ToggleGroupState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the group context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: ToggleGroupState = {
        disabled: group?.disabled() ?? false,
        multiple: group?.multiple() ?? false,
        orientation: group?.orientation() ?? "horizontal",
      };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface ToggleGroupState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple: boolean;
  /**
   * The orientation of the toggle group.
   */
  orientation: Orientation;
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

export type ToggleGroupProps<Value extends string = string, T extends JSX.ElementType = "div"> = ToggleGroupOwnProps<Value> &
  RebaseUIComponentProps<T, ToggleGroupState>;

export type ToggleGroupChangeEventReason = typeof REASONS.none;
export type ToggleGroupChangeEventDetails = RebaseUIChangeEventDetails<ToggleGroupChangeEventReason>;

export namespace ToggleGroup {
  export type State = ToggleGroupState;
  export type Props<Value extends string = string, T extends JSX.ElementType = "div"> = ToggleGroupProps<Value, T>;
  export type OwnProps<Value extends string = string> = ToggleGroupOwnProps<Value>;
  export type ChangeEventReason = ToggleGroupChangeEventReason;
  export type ChangeEventDetails = ToggleGroupChangeEventDetails;
}

import { dynamicElement, omitProps, store as createStore, untrack, type JSX } from "reze-js";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { stableCallback } from "../../internals/stableCallback";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { useMenuFilterImpl } from "../filter-root/MenuFilterContext";
import { MenuGroupContext } from "../group/MenuGroupContext";
import type { MenuRoot } from "../root/MenuRoot";
import { MenuRadioGroupContext } from "./MenuRadioGroupContext";

export function MenuRadioGroupPlain<T extends JSX.ElementType = "div">(props: MenuRadioGroup.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "value",
    "defaultValue",
    "onValueChange",
    "disabled",
    "aria-labelledby",
    "class",
    "style",
    "children",
    "ref",
  );
  // Deliberately not hoisted: group children must be created inside the group
  // context provider below, not in this body.

  const labelState = createStore({ labelId: undefined as string | undefined });

  function labelId(): string | undefined {
    return labelState.labelId;
  }

  function setLabelId(id: string | undefined): void {
    untrack(() => {
      if (labelState.labelId !== id) {
        labelState.labelId = id;
      }
    });
  }

  const [value, setValueUnwrapped] = createControllableSignal({
    value: () => props.value,
    defaultValue: () => props.defaultValue,
  });

  const onValueChange = stableCallback(() => props.onValueChange);

  function setValue(newValue: any, eventDetails: MenuRadioGroup.ChangeEventDetails) {
    onValueChange(newValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(newValue);
  }

  function snapshot(): MenuRadioGroupState {
    return {
      disabled: props.disabled ?? false,
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const radioContextValue: MenuRadioGroupContext = {
    get value() {
      return value();
    },
    setValue,
    get disabled() {
      return props.disabled ?? false;
    },
  };

  // The providers live inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the radio items without context. Children
  // resolve in MenuRadioGroupContent below so they are created inside the providers.
  //
  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic
  // element re-creates its DOM node whenever a sibling mounts or unmounts. The default
  // path renders a static `<div>` so filter updates patch it in place; only a
  // customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="group"
        aria-labelledby={props["aria-labelledby"] ?? labelId()}
        aria-disabled={props.disabled === true ? "true" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        <MenuGroupContext value={{ labelId, setLabelId }}>
          <MenuRadioGroupContext value={radioContextValue}>
            <MenuRadioGroupContent disabled={props.disabled ?? false}>{props.children}</MenuRadioGroupContent>
          </MenuRadioGroupContext>
        </MenuGroupContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="group"
      aria-labelledby={props["aria-labelledby"] ?? labelId()}
      aria-disabled={props.disabled === true ? "true" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <MenuGroupContext value={{ labelId, setLabelId }}>
        <MenuRadioGroupContext value={radioContextValue}>
          <MenuRadioGroupContent disabled={props.disabled ?? false}>{props.children}</MenuRadioGroupContent>
        </MenuRadioGroupContext>
      </MenuGroupContext>
    </Tag>
  );
}

/**
 * Resolves the group children inside the group contexts. Zero-argument functions pass
 * through untouched: Reze control-flow primitives return thunks, and invoking one here
 * would resolve the subtree one-shot instead of binding it.
 */
function MenuRadioGroupContent(props: { children: ChildrenValue<MenuRadioGroupState>; disabled: boolean }) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: MenuRadioGroupState) => JSX.Element;
    // Created eagerly in this body so parts inherit the group context owners.
    return render({ disabled: props.disabled });
  }

  return children as JSX.Element;
}

/**
 * Groups related radio items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioGroup<T extends JSX.ElementType = "div">(props: MenuRadioGroup.Props<T>) {
  const Group = useMenuFilterImpl()?.RadioGroup ?? MenuRadioGroupPlain;
  return <Group {...(props as Record<string, unknown>)} />;
}

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

export type MenuRadioGroupProps<T extends JSX.ElementType = "div"> = MenuRadioGroupOwnProps & RebaseUIComponentProps<T, MenuRadioGroupState>;

export namespace MenuRadioGroup {
  export type State = MenuRadioGroupState;
  export type Props<T extends JSX.ElementType = "div"> = MenuRadioGroupProps<T>;
  export type OwnProps = MenuRadioGroupOwnProps;
  export type ChangeEventReason = MenuRadioGroupChangeEventReason;
  export type ChangeEventDetails = MenuRadioGroupChangeEventDetails;
}

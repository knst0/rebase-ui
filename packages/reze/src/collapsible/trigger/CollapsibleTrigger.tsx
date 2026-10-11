import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useCollapsibleRootContext } from "../root/CollapsibleRootContext";

/**
 * A button that opens and closes the collapsible panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/collapsible)
 */
export function CollapsibleTrigger<T extends JSX.ElementType = "button">(props: CollapsibleTrigger.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "nativeButton", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const root = useCollapsibleRootContext();

  function disabled(): boolean {
    return props.disabled ?? root.disabled();
  }

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get nativeButton() {
      return props.nativeButton;
    },
    get ref() {
      return props.ref;
    },
    // A custom onClick replaces the trigger logic, mirroring the Solid layer order
    // where element props overwrite the internal trigger props.
    get onClick() {
      return props.onClick ?? root.handleTrigger;
    },
    get onMouseDown() {
      return props.onMouseDown;
    },
    get onKeyDown() {
      return props.onKeyDown;
    },
    get onKeyUp() {
      return props.onKeyUp;
    },
    get onPointerDown() {
      return props.onPointerDown;
    },
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      type={button.type}
      role={button.role}
      bool:disabled={button.disabled}
      tabindex={button.tabIndex}
      aria-disabled={button.ariaDisabled}
      aria-controls={root.open() ? root.panelId() : undefined}
      aria-expanded={root.open() ? "true" : "false"}
      data-panel-open={root.open() ? "" : undefined}
      data-starting-style={root.transitionStatus() === "starting" ? "" : undefined}
      data-ending-style={root.transitionStatus() === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, { open: root.open(), disabled: root.disabled(), transitionStatus: root.transitionStatus() })}
      style={resolveStyleValue(props.style, { open: root.open(), disabled: root.disabled(), transitionStatus: root.transitionStatus() })}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      ref={button.buttonRef}
    >
      {resolveChildrenValue(children, () => ({
        open: root.open(),
        disabled: root.disabled(),
        transitionStatus: root.transitionStatus(),
      }))}
    </Tag>
  );
}

export interface CollapsibleTriggerState {
  /**
   * Whether the collapsible panel is currently open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CollapsibleTriggerOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * If `undefined`, defaults to the `disabled` prop of the root.
   */
  disabled?: boolean | undefined;
}

export type CollapsibleTriggerProps<T extends JSX.ElementType = "button"> = CollapsibleTriggerOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, CollapsibleTriggerState>;

export namespace CollapsibleTrigger {
  export type State = CollapsibleTriggerState;
  export type Props<T extends JSX.ElementType = "button"> = CollapsibleTriggerProps<T>;
  export type OwnProps = CollapsibleTriggerOwnProps;
}

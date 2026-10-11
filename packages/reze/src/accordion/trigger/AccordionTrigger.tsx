import { dynamicElement, effect, omitProps, type JSX } from "reze-js";

import { useCollapsibleRootContext } from "../../collapsible/root/CollapsibleRootContext";
import { createButton } from "../../internals/create-button";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { AccordionItemState } from "../item/AccordionItem";
import { useAccordionItemContext } from "../item/AccordionItemContext";

/**
 * A button that opens and closes the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/accordion)
 */
export function AccordionTrigger<T extends JSX.ElementType = "button">(props: AccordionTrigger.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "id", "nativeButton", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const collapsible = useCollapsibleRootContext();

  function disabled(): boolean {
    return props.disabled || collapsible.disabled();
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
      return props.onClick ?? collapsible.handleTrigger;
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

  const { state, setTriggerId, triggerId } = useAccordionItemContext();

  effect(() => {
    const id = props.id;

    if (id !== undefined) {
      setTriggerId(id);
    }
  });

  function snapshot(): AccordionTriggerState {
    return {
      value: state.value(),
      disabled: state.disabled(),
      hidden: state.hidden(),
      index: state.index(),
      open: state.open(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the trigger's focus every time
  // the panel appears or disappears. The default path renders a static
  // `<button>` so updates patch it in place; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <button
        {...(rest as Record<string, unknown>)}
        type={button.type}
        role={button.role}
        bool:disabled={button.disabled}
        tabindex={button.tabIndex}
        aria-disabled={button.ariaDisabled}
        aria-controls={collapsible.open() ? collapsible.panelId() : undefined}
        aria-expanded={collapsible.open() ? "true" : "false"}
        id={triggerId()}
        data-panel-open={collapsible.open() ? "" : undefined}
        data-index={String(state.index())}
        data-disabled={state.disabled() ? "" : undefined}
        data-hidden={state.hidden() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onClick={button.onClick}
        onMouseDown={button.onMouseDown}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        ref={button.buttonRef}
      >
        {resolveChildrenValue(children, snapshot)}
      </button>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      type={button.type}
      role={button.role}
      bool:disabled={button.disabled}
      tabindex={button.tabIndex}
      aria-disabled={button.ariaDisabled}
      aria-controls={collapsible.open() ? collapsible.panelId() : undefined}
      aria-expanded={collapsible.open() ? "true" : "false"}
      id={triggerId()}
      data-panel-open={collapsible.open() ? "" : undefined}
      data-index={String(state.index())}
      data-disabled={state.disabled() ? "" : undefined}
      data-hidden={state.hidden() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      ref={button.buttonRef}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface AccordionTriggerState extends AccordionItemState {}

export interface AccordionTriggerOwnProps extends NativeButtonProps {}

export type AccordionTriggerProps<T extends JSX.ElementType = "button"> = AccordionTriggerOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, AccordionTriggerState>;

export namespace AccordionTrigger {
  export type State = AccordionTriggerState;
  export type Props<T extends JSX.ElementType = "button"> = AccordionTriggerProps<T>;
  export type OwnProps = AccordionTriggerOwnProps;
}

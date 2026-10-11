import { findItemIndex } from "@rebase-ui/core/itemEquality";
import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { stopEvent } from "../../internals/floating/utils/event";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { getHighlightReason } from "../../internals/utils/getHighlightReason";
import { useComboboxChipContext } from "../chip/ComboboxChipContext";
import { useComboboxRootContext } from "../root/ComboboxRootContext";

/**
 * A button to remove a chip.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChipRemove<T extends JSX.ElementType = "button">(props: ComboboxChipRemove.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "nativeButton", "onClick", "onKeyDown", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useComboboxRootContext();
  const { index } = useComboboxChipContext();

  function disabled() {
    return (store.select("disabled") as boolean) || props.disabled === true;
  }

  function buttonDisabled() {
    return disabled() || (store.select("readOnly") as boolean);
  }

  const button = createButton({
    get disabled() {
      return buttonDisabled();
    },
    get focusableWhenDisabled() {
      return true;
    },
    get nativeButton() {
      return props.nativeButton;
    },
    get onClick() {
      return handleClick;
    },
    get onKeyDown() {
      return handleKeyDown;
    },
  });

  function snapshot(): ComboboxChipRemoveState {
    return { disabled: disabled() };
  }

  function clearActiveIndexForRemovedItem(removedItem: unknown, event: Event) {
    const activeIndex = store.peek("activeIndex") as number | null;

    if (activeIndex == null) {
      return;
    }

    // Try current visible list first; if not found, it's filtered out.
    // No need to clear highlight in that case since it can't equal activeIndex.
    const removedIndex = findItemIndex(store.context.valuesRef.current, removedItem, store.peek("isItemEqualToValue"));
    if (removedIndex !== -1 && activeIndex === removedIndex) {
      store.context.setIndices({
        activeIndex: null,
        type: getHighlightReason(event),
        event,
      });
    }
  }

  function removeChip(event: MouseEvent | KeyboardEvent) {
    const eventDetails = createChangeEventDetails(REASONS.chipRemovePress, event);
    const selectedValue = store.peek("selectedValue") as Array<unknown>;
    const currentIndex = index();
    const removedItem = selectedValue[currentIndex];

    clearActiveIndexForRemovedItem(removedItem, event);

    store.context.setSelectedValue(
      selectedValue.filter((_: unknown, i: number) => i !== currentIndex),
      eventDetails,
    );

    store.context.inputRef.current?.focus();
    return eventDetails;
  }

  function handleMouseDown(event: MouseEvent) {
    event.preventDefault();
  }

  function handleClick(event: MouseEvent) {
    const eventDetails = removeChip(event);
    if (!eventDetails.isPropagationAllowed) {
      event.stopPropagation();
    }
    (props.onClick as ((event: MouseEvent) => void) | undefined)?.(event);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      const eventDetails = removeChip(event);
      if (!eventDetails.isPropagationAllowed) {
        stopEvent(event);
      }
    }
    (props.onKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  // `as` is resolved once: the default path renders a static `<button>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <button
        {...(rest as Record<string, unknown>)}
        type={button.type}
        role={button.role}
        bool:disabled={button.disabled}
        tabindex={-1}
        aria-disabled={button.ariaDisabled}
        onMouseDown={handleMouseDown}
        onClick={button.onClick}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        data-disabled={disabled() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(button.buttonRef, props.ref as ((element: HTMLElement | null) => void) | undefined)}
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
      tabindex={-1}
      aria-disabled={button.ariaDisabled}
      onMouseDown={handleMouseDown}
      onClick={button.onClick}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      data-disabled={disabled() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={mergeRefs(button.buttonRef, props.ref as ((element: HTMLElement | null) => void) | undefined)}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface ComboboxChipRemoveState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipRemoveOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
}

export type ComboboxChipRemoveProps<T extends JSX.ElementType = "button"> = ComboboxChipRemoveOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ComboboxChipRemoveState>;

export namespace ComboboxChipRemove {
  export type State = ComboboxChipRemoveState;
  export type Props<T extends JSX.ElementType = "button"> = ComboboxChipRemoveProps<T>;
  export type OwnProps = ComboboxChipRemoveOwnProps;
}

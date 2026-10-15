import { dynamicElement, omitProps, store as createStore, untrack, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { getHighlightReason } from "../../internals/utils/getHighlightReason";
import { useComboboxInputValueContext, useComboboxRootContext } from "../root/ComboboxRootContext";

/**
 * Clears the value when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxClear<T extends JSX.ElementType = "button">(props: ComboboxClear.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "disabled",
    "nativeButton",
    "keepMounted",
    "onClick",
    "onMouseDown",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const keepMounted = untrack(() => props.keepMounted ?? false);

  const field = useFieldRootContext();
  const store = useComboboxRootContext();
  const inputValue = useComboboxInputValueContext();

  function disabled() {
    return field.disabled() === true || (store.select("disabled") as boolean) === true || props.disabled === true;
  }

  function visible() {
    const selectionMode = store.select("selectionMode") as string;
    if (selectionMode === "none") {
      return inputValue() !== "";
    }
    if (selectionMode === "single") {
      return (store.select("selectedValue") as unknown) != null;
    }
    return (store.select("hasSelectionChips") as boolean) === true;
  }

  const transition = createStore({ mounted: false, transitionStatus: undefined as TransitionStatus });

  function setMounted(next: boolean) {
    if (transition.mounted !== next) {
      transition.mounted = next;
    }
  }

  function setTransitionStatus(next: TransitionStatus) {
    if (transition.transitionStatus !== next) {
      transition.transitionStatus = next;
    }
  }

  createTransitionStatus({
    open: visible,
    mounted: () => transition.mounted,
    transitionStatus: () => transition.transitionStatus,
    setMounted,
    setTransitionStatus,
  });

  let clearElement: HTMLButtonElement | null = null;
  runOnOpenChangeComplete({
    open: visible,
    ref: () => clearElement,
    onComplete() {
      if (!visible()) {
        setMounted(false);
      }
    },
  });

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get nativeButton() {
      return props.nativeButton;
    },
    get onClick() {
      return handleClick;
    },
    get onMouseDown() {
      return handleMouseDown;
    },
  });

  function snapshot(): ComboboxClearState {
    return {
      open: store.select("open") as boolean,
      disabled: disabled(),
      visible: visible(),
      transitionStatus: transition.transitionStatus as TransitionStatus,
    };
  }

  function handleClick(event: MouseEvent) {
    if (!disabled() && !(store.peek("readOnly") as boolean)) {
      const type = getHighlightReason(event);

      store.context.setInputValue("", createChangeEventDetails(REASONS.clearPress, event));

      const selectionMode = store.peek("selectionMode") as string;
      if (selectionMode !== "none") {
        const selectedValue = store.peek("selectedValue") as unknown;
        store.context.setSelectedValue(Array.isArray(selectedValue) ? [] : null, createChangeEventDetails(REASONS.clearPress, event));
        // A distinct object shape: `update` iterates own keys, so passing an explicit
        // `selectedIndex: undefined` would overwrite the state instead of leaving it alone.
        store.context.setIndices({
          activeIndex: null,
          selectedIndex: null,
          type,
          event,
        });
      } else {
        store.context.setIndices({ activeIndex: null, type, event });
      }

      store.context.inputRef.current?.focus();
    }
    (props.onClick as ((event: MouseEvent) => void) | undefined)?.(event);
  }

  function handleMouseDown(event: MouseEvent) {
    // Avoid stealing focus from the input.
    event.preventDefault();
    (props.onMouseDown as ((event: MouseEvent) => void) | undefined)?.(event);
  }

  function shouldRender() {
    return keepMounted || transition.mounted;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  // `as` is resolved once: the default path renders a static `<button>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {shouldRender() && (
          <button
            {...(rest as Record<string, unknown>)}
            tabindex={-1}
            type={button.type}
            role={button.role}
            bool:disabled={button.disabled}
            aria-disabled={button.ariaDisabled}
            onMouseDown={button.onMouseDown}
            onClick={button.onClick}
            onKeyDown={button.onKeyDown}
            onKeyUp={button.onKeyUp}
            onPointerDown={button.onPointerDown}
            data-popup-open={(store.select("open") as boolean) ? "" : undefined}
            data-disabled={disabled() ? "" : undefined}
            data-visible={visible() ? "" : undefined}
            data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
            data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={mergeRefs(
              props.ref as ((element: HTMLElement | null) => void) | undefined,
              button.buttonRef,
              (element: HTMLButtonElement | null) => {
                clearElement = element;
                store.context.clearRef.current = element;
              },
            )}
          >
            {resolveChildrenValue(children === undefined ? "x" : children, snapshot)}
          </button>
        )}
      </>
    );
  }

  return (
    <>
      {shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          tabindex={-1}
          type={button.type}
          role={button.role}
          bool:disabled={button.disabled}
          aria-disabled={button.ariaDisabled}
          onMouseDown={button.onMouseDown}
          onClick={button.onClick}
          onKeyDown={button.onKeyDown}
          onKeyUp={button.onKeyUp}
          onPointerDown={button.onPointerDown}
          data-popup-open={(store.select("open") as boolean) ? "" : undefined}
          data-disabled={disabled() ? "" : undefined}
          data-visible={visible() ? "" : undefined}
          data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
          data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={mergeRefs(
            props.ref as ((element: HTMLElement | null) => void) | undefined,
            button.buttonRef,
            (element: HTMLButtonElement | null) => {
              clearElement = element;
              store.context.clearRef.current = element;
            },
          )}
        >
          {resolveChildrenValue(children === undefined ? "x" : children, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface ComboboxClearState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the clear button should be visible.
   */
  visible: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface ComboboxClearOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the component should remain mounted in the DOM when not visible.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type ComboboxClearProps<T extends JSX.ElementType = "button"> = ComboboxClearOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ComboboxClearState>;

export namespace ComboboxClear {
  export type State = ComboboxClearState;
  export type Props<T extends JSX.ElementType = "button"> = ComboboxClearProps<T>;
  export type OwnProps = ComboboxClearOwnProps;
}

import { createUniqueId, dynamicElement, omitProps, store as createStore, untrack, type JSX } from "reze-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { platform } from "../../internals/utils/platform";
import {
  useFilterDropdownItemContext,
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from "../root/FilterDropdownRootContext";
import { isRefocusingOwner, refocusOwner } from "../utils/refocusOwner";

/**
 * @internal
 */
export function FilterDropdownInput<T extends JSX.ElementType = "input">(props: FilterDropdownInput.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "id",
    "disabled",
    "activeItemId",
    "navigationProps",
    "onCompositionStart",
    "onCompositionEnd",
    "onInput",
    "onKeyDown",
    "onPointerDown",
    "onMouseEnter",
    "onFocus",
    "onBlur",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  // Browsers flag a form field with neither an id nor a name.
  // One-shot read (matching the Solid layer, where it is untracked).
  const id = props.id ?? createUniqueId();

  const context = useFilterDropdownRootContext();
  const { listRef } = useFilterDropdownItemContext();
  const value = useFilterDropdownValueContext();

  // IME text isn't committed until the composition ends, so filtering waits for it.
  const composing = createStore({ value: null as string | null });
  let isComposing = false;

  function commitValue(nextValue: string, nativeEvent: Event) {
    const reason = nextValue === "" ? REASONS.inputClear : REASONS.inputChange;
    context.onValueChange(nextValue, createChangeEventDetails(reason, nativeEvent));
  }

  function highlighted(): boolean {
    return context.inputFocusVisible() && (!context.keyboardModality() || props.activeItemId == null);
  }

  function snapshot(): FilterDropdownInputState {
    return { highlighted: highlighted() };
  }

  function disabled(): boolean {
    return context.disabled() || props.disabled === true;
  }

  // Live view of the consumer handlers omitted from the spread above.
  const userHandlers = props as unknown as {
    onCompositionStart?: ((event: CompositionEvent) => void) | undefined;
    onCompositionEnd?: ((event: CompositionEvent) => void) | undefined;
    onInput?: ((event: InputEvent) => void) | undefined;
    onKeyDown?: ((event: KeyboardEvent) => void) | undefined;
    onPointerDown?: ((event: PointerEvent) => void) | undefined;
    onMouseEnter?: ((event: MouseEvent) => void) | undefined;
    onFocus?: ((event: FocusEvent) => void) | undefined;
    onBlur?: ((event: FocusEvent) => void) | undefined;
  };

  function navigationHandler(key: string): ((event: never) => void) | undefined {
    return props.navigationProps?.[key] as ((event: never) => void) | undefined;
  }

  // Handlers chain across layers — the consumer's, then the internal one, then the host's —
  // so the host's key routing and the consumer's handlers run alongside the internal ones
  // instead of replacing them.
  function handleCompositionStart(event: CompositionEvent): void {
    userHandlers.onCompositionStart?.(event);
    // Some Android keyboards treat all typing as one composition.
    if (!platform.os.android) {
      isComposing = true;
      composing.value = (event.currentTarget as HTMLInputElement).value;
    }
    navigationHandler("onCompositionStart")?.(event as never);
  }

  function handleCompositionEnd(event: CompositionEvent): void {
    userHandlers.onCompositionEnd?.(event);
    if (isComposing) {
      isComposing = false;
      composing.value = null;
      commitValue((event.currentTarget as HTMLInputElement).value, event);
    }
    navigationHandler("onCompositionEnd")?.(event as never);
  }

  function handleInput(event: InputEvent): void {
    userHandlers.onInput?.(event);
    const nextValue = (event.currentTarget as HTMLInputElement).value;
    if (isComposing) {
      composing.value = nextValue;
    } else {
      commitValue(nextValue, event);
    }
    navigationHandler("onInput")?.(event as never);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    userHandlers.onKeyDown?.(event);
    context.setKeyboardModality(true);
    navigationHandler("onKeyDown")?.(event as never);
  }

  function handlePointerDown(event: PointerEvent): void {
    userHandlers.onPointerDown?.(event);
    context.setKeyboardModality(false);
    navigationHandler("onPointerDown")?.(event as never);
  }

  function handleMouseEnter(event: MouseEvent): void {
    userHandlers.onMouseEnter?.(event);
    context.setKeyboardModality(false);
    // Take focus so typing filters immediately.
    if (untrack(context.open)) {
      refocusOwner(event.currentTarget as HTMLInputElement);
    }
    navigationHandler("onMouseEnter")?.(event as never);
  }

  function handleFocus(event: FocusEvent): void {
    userHandlers.onFocus?.(event);
    context.setInputFocusVisible(true);

    // A screen reader that followed `aria-activedescendant` put real focus on the item, so
    // focus returning from an item means the user moved back to the input on purpose and
    // the highlight no longer reflects where they are. The list's own key replay and
    // pointer refocus also pass through here and keep it.
    if (context.autoHighlight !== "always" && !isRefocusingOwner()) {
      const from = event.relatedTarget as HTMLElement | null;
      if (from !== null && listRef.current.includes(from)) {
        context.setActiveIndex(null);
      }
    }
    navigationHandler("onFocus")?.(event as never);
  }

  function handleBlur(event: FocusEvent): void {
    userHandlers.onBlur?.(event);
    context.setInputFocusVisible(false);
    navigationHandler("onBlur")?.(event as never);
  }

  const ref = mergeRefs(
    (element: HTMLInputElement | null) => {
      context.focusOwnerRef.current = element;
    },
    props.ref as ((element: HTMLInputElement | null) => void) | undefined,
  );

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "input");

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // input's value, focus, and listeners every time an item appears or disappears. The
  // default path renders a static `<input>` so filter updates patch it in place; only a
  // customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <input
        {...(rest as Record<string, unknown>)}
        id={id}
        type="text"
        bool:disabled={disabled()}
        role="searchbox"
        inputmode="search"
        autocomplete="off"
        spellcheck="false"
        autocorrect="off"
        autocapitalize="none"
        aria-activedescendant={props.activeItemId}
        aria-controls={context.listId()}
        value={composing.value ?? value()}
        data-highlighted={highlighted() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        onBlur={handleBlur}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </input>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={id}
      type="text"
      bool:disabled={disabled()}
      role="searchbox"
      inputmode="search"
      autocomplete="off"
      spellcheck="false"
      autocorrect="off"
      autocapitalize="none"
      aria-activedescendant={props.activeItemId}
      aria-controls={context.listId()}
      value={composing.value ?? value()}
      data-highlighted={highlighted() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      onBlur={handleBlur}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface FilterDropdownInputState {
  /**
   * Whether the input shows its focus ring.
   * Cleared when keyboard navigation highlights an item.
   */
  highlighted: boolean;
}

export interface FilterDropdownInputOwnProps {
  /**
   * The id of the item the host highlights, which the input points at while it holds focus.
   */
  activeItemId?: string | undefined;
  /**
   * The host's list navigation props. The host routes key presses itself, so these exclude a
   * key handler.
   */
  navigationProps?: Record<string, unknown> | undefined;
  id?: string | undefined;
  disabled?: boolean | undefined;
}

export type FilterDropdownInputProps<T extends JSX.ElementType = "input"> = FilterDropdownInputOwnProps &
  RebaseUIComponentProps<T, FilterDropdownInputState>;

export namespace FilterDropdownInput {
  export type Props<T extends JSX.ElementType = "input"> = FilterDropdownInputProps<T>;
  export type State = FilterDropdownInputState;
}

import { dynamicElement, flush, getOwner, omitProps, runWithOwner, type JSX } from "reze-js";

import { useCompositeListItem } from "../../internals/composite";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { stopEvent } from "../../internals/floating/utils/event";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { useComboboxChipsContext } from "../chips/ComboboxChipsContext";
import { useComboboxRootContext } from "../root/ComboboxRootContext";
import { getChipNavigationKeys, getIndexAfterChipRemoval } from "../utils/parts";
import { ComboboxChipContext } from "./ComboboxChipContext";

/**
 * An individual chip that represents a value in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChip<T extends JSX.ElementType = "div">(props: ComboboxChip.Props<T>) {
  const rest = omitProps(props, "as", "onKeyDown", "class", "style", "children", "ref");
  // Deliberately not hoisted: chip children must be created inside the chip
  // context provider below, not in this body.

  const store = useComboboxRootContext();
  const chipsContext = useComboboxChipsContext();
  if (!chipsContext) {
    throw new Error("Rebase UI: ComboboxChipsContext is missing. ComboboxChip parts must be placed within <Combobox.Chips>.");
  }
  const { chipsRef } = chipsContext;

  const { ref: listItemRef, index } = useCompositeListItem();

  function handleKeyDown(event: KeyboardEvent): number | undefined {
    const currentIndex = index();
    let nextIndex: number | undefined = currentIndex;
    const owner = event.currentTarget instanceof Element ? event.currentTarget.ownerDocument : document;
    const direction = owner.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const [previousChipKey, nextChipKey] = getChipNavigationKeys(direction);
    const selectedValue = store.peek("selectedValue") as Array<unknown>;

    if (event.key === previousChipKey) {
      event.preventDefault();
      if (currentIndex > 0) {
        nextIndex = currentIndex - 1;
      } else {
        nextIndex = undefined;
      }
    } else if (event.key === nextChipKey) {
      event.preventDefault();
      if (currentIndex < chipsRef.current.length - 1) {
        nextIndex = currentIndex + 1;
      } else {
        nextIndex = undefined;
      }
    } else if (event.key === "Backspace" || event.key === "Delete") {
      nextIndex = getIndexAfterChipRemoval(currentIndex, selectedValue.length);

      stopEvent(event);

      // Commit the removal before focusing so `chipsRef` reflects the remaining chips.
      store.context.setIndices({
        activeIndex: null,
        selectedIndex: null,
        type: REASONS.keyboard,
        event,
      });
      store.context.setSelectedValue(
        selectedValue.filter((_: unknown, i: number) => i !== currentIndex),
        createChangeEventDetails(REASONS.none, event),
      );
      flush();
    } else if (event.key === "Enter" || event.key === " ") {
      stopEvent(event);
      nextIndex = undefined;
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      stopEvent(event);
      // The input may mount when opening.
      store.context.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
      flush();
      nextIndex = undefined;
    } else if (
      // Check for printable characters (letters, numbers, symbols)
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      nextIndex = undefined;
    }

    return nextIndex;
  }

  function disabled() {
    return store.select("disabled") as boolean;
  }

  function snapshot(): ComboboxChipState {
    return { disabled: disabled() };
  }

  function handleKeyDownEvent(event: KeyboardEvent) {
    if (!store.peek("disabled") && !store.peek("readOnly")) {
      const nextIndex = handleKeyDown(event);

      if (nextIndex === undefined) {
        store.context.inputRef.current?.focus();
      } else {
        chipsRef.current[nextIndex]?.focus();
      }
    }
    (props.onKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
  }

  const contextValue: ComboboxChipContext = {
    index,
  };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the chip parts without context. Children
  // resolve in ComboboxChipContent below so they are created inside the provider.
  //
  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        tabindex={-1}
        aria-disabled={disabled() ? "true" : undefined}
        aria-readonly={(store.select("readOnly") as boolean) ? "true" : undefined}
        onKeyDown={handleKeyDownEvent}
        data-disabled={disabled() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(listItemRef, props.ref as ((element: HTMLElement | null) => void) | undefined)}
      >
        <ComboboxChipContext value={contextValue}>
          <ComboboxChipContent disabled={disabled()}>{props.children}</ComboboxChipContent>
        </ComboboxChipContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      tabindex={-1}
      aria-disabled={disabled() ? "true" : undefined}
      aria-readonly={(store.select("readOnly") as boolean) ? "true" : undefined}
      onKeyDown={handleKeyDownEvent}
      data-disabled={disabled() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={mergeRefs(listItemRef, props.ref as ((element: HTMLElement | null) => void) | undefined)}
    >
      <ComboboxChipContext value={contextValue}>
        <ComboboxChipContent disabled={disabled()}>{props.children}</ComboboxChipContent>
      </ComboboxChipContext>
    </Tag>
  );
}

/**
 * Resolves the chip children inside the chip context.
 */
function ComboboxChipContent(props: { children: unknown; disabled: boolean }) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: ComboboxChipState) => JSX.Element;
    const owner = getOwner();

    return () => {
      const snapshot: ComboboxChipState = { disabled: props.disabled };
      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface ComboboxChipState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipOwnProps {}

export type ComboboxChipProps<T extends JSX.ElementType = "div"> = ComboboxChipOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ComboboxChipState>;

export namespace ComboboxChip {
  export type State = ComboboxChipState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxChipProps<T>;
  export type OwnProps = ComboboxChipOwnProps;
}

import { createEffect, untrack } from "solid-js";

import { isElementVisible, isListIndexDisabled, type DisabledIndices } from "../../composite/composite";
import type { FloatingContext } from "../types";
import { contains } from "../utils/element";
import { stopEvent } from "../utils/event";

export interface CreateTypeaheadProps {
  /** Array of strings whose indices match the list item elements. Static holder. */
  listRef: { current: Array<string | null> };
  /** Active item index; accepts an accessor to stay reactive. @default null */
  activeIndex?: number | null | (() => number | null) | undefined;
  /** Callback invoked with the matching index as the user types. */
  onMatch?: ((index: number) => void) | undefined;
  /** Item elements corresponding to `listRef` indices; hidden/disabled ones are skipped. */
  elementsRef?: { current: Array<HTMLElement | null> } | undefined;
  /** Indices to skip while matching (same shape as list navigation). */
  disabledIndices?: DisabledIndices | undefined;
  /** Callback invoked with the current typing activity. */
  onTyping?: ((isTyping: boolean) => void) | undefined;
  /** Whether the interaction is enabled. Read once. @default true */
  enabled?: boolean | undefined;
  /** Milliseconds to wait before resetting the typed string. Read once. @default 750 */
  resetMs?: number | undefined;
  /** Selected item index; accepts an accessor to stay reactive. @default null */
  selectedIndex?: number | null | (() => number | null) | undefined;
}

export interface TypeaheadProps {
  onKeyDown: (event: KeyboardEvent) => void;
  onBlur: (event: FocusEvent) => void;
}

export interface CreateTypeaheadResult {
  /** Getter returning props to spread onto the Solid reference element. */
  reference: () => TypeaheadProps;
  /** Getter returning props to spread onto the Solid floating element. */
  floating: () => TypeaheadProps;
}

function readIndex(value: number | null | (() => number | null) | undefined): number | null {
  if (typeof value === "function") {
    return (value as () => number | null)();
  }
  return value ?? null;
}

/**
 * Matches and focuses an item as the user types, used with `createListNavigation`.
 * Solid port of upstream `useTypeahead` (mui/base-ui v1.8.0).
 * Handlers receive native DOM events; the typed buffer resets after `resetMs`.
 */
export function createTypeahead(context: FloatingContext, props: CreateTypeaheadProps): CreateTypeaheadResult {
  const store = context.rootStore;

  const enabled = untrack(() => props.enabled ?? true);
  const resetMs = untrack(() => props.resetMs ?? 750);
  const listRef = untrack(() => props.listRef);
  const elementsRef = untrack(() => props.elementsRef);
  const disabledIndices = untrack(() => props.disabledIndices);

  let buffer = "";
  let prevIndex: number | null = readIndex(untrack(() => props.selectedIndex)) ?? readIndex(untrack(() => props.activeIndex)) ?? -1;
  let matchIndex: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function clearTimer() {
    clearTimeout(timeoutId);
    timeoutId = undefined;
  }

  // Clear the pending buffer reset when the interaction owner disposes.
  createEffect(
    () => undefined,
    () => () => {
      clearTimer();
    },
  );

  function isItemAvailable(index: number): boolean {
    const element = elementsRef?.current[index];
    if ((element && !isElementVisible(element)) || (element as HTMLElement | undefined)?.matches?.(":disabled")) {
      return false;
    }
    // Visibility and native disabled state are handled above; pass an empty
    // list so only the explicit `disabledIndices` apply here.
    return disabledIndices == null || !isListIndexDisabled([], index, disabledIndices);
  }

  function getMatchingIndex(list: Array<string | null>, value: string, startIndex = 0): number {
    if (list.length === 0) {
      return -1;
    }
    const normalizedStart = ((startIndex % list.length) + list.length) % list.length;
    const lowerValue = value.toLowerCase();
    for (let offset = 0; offset < list.length; offset += 1) {
      const index = (normalizedStart + offset) % list.length;
      const text = list[index];
      if (!text?.toLowerCase().startsWith(lowerValue) || !isItemAvailable(index)) {
        continue;
      }
      return index;
    }
    return -1;
  }

  function endSession() {
    clearTimer();
    buffer = "";
    prevIndex = matchIndex;
    props.onTyping?.(false);
  }

  const sharedProps: TypeaheadProps = {
    onKeyDown(event) {
      const listContent = listRef.current;

      if (buffer.length > 0 && event.key === " ") {
        // Space continues the in-progress typeahead session.
        stopEvent(event);
        props.onTyping?.(true);
      }

      if (buffer.length > 0 && buffer[0] !== " " && event.key !== " ") {
        if (getMatchingIndex(listContent, buffer) === -1) {
          props.onTyping?.(false);
        }
      }

      if (listContent == null || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (store.select("open") && event.key !== " ") {
        stopEvent(event);
        props.onTyping?.(true);
      }

      const isNewSession = buffer === "";
      if (isNewSession) {
        prevIndex = readIndex(props.selectedIndex) ?? readIndex(props.activeIndex) ?? -1;
      }

      // Rapid succession through same-letter items (unless a label like
      // "llama" makes the prefix ambiguous); unavailable items are ignored.
      const allowRapidSuccession = listContent.every((text, index) =>
        text && isItemAvailable(index) ? text[0]?.toLowerCase() !== text[1]?.toLowerCase() : true,
      );
      if (allowRapidSuccession && buffer === event.key) {
        buffer = "";
        prevIndex = matchIndex;
      }

      buffer += event.key;
      clearTimer();
      timeoutId = setTimeout(() => {
        buffer = "";
        prevIndex = matchIndex;
        props.onTyping?.(false);
      }, resetMs);

      const startIndex = (prevIndex ?? 0) + 1;
      const index = getMatchingIndex(listContent, buffer, startIndex);

      if (index !== -1) {
        props.onMatch?.(index);
        matchIndex = index;
      } else if (event.key !== " ") {
        buffer = "";
        props.onTyping?.(false);
      }
    },
    onBlur(event) {
      const next = event.relatedTarget as Element | null;
      const withinComposite = contains(store.select("domReferenceElement"), next) || contains(store.select("floatingElement"), next);
      // Keep the session while focus moves within the composite.
      if (withinComposite) {
        return;
      }
      endSession();
    },
  };

  createEffect(
    () => ({ open: store.select("open"), selected: readIndex(props.selectedIndex) }),
    ({ open, selected }) => {
      if (!open && selected !== null) {
        return;
      }
      clearTimer();
      matchIndex = null;
      if (buffer !== "") {
        buffer = "";
      }
    },
  );

  const empty = {} as TypeaheadProps;
  const reference = () => (enabled ? sharedProps : empty);
  const floating = () => (enabled ? sharedProps : empty);

  return { reference, floating };
}

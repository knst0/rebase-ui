import { dynamicElement, effect, omitProps, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxDerivedItemsContext, useComboboxRootContext } from "../root/ComboboxRootContext";
import type { ComboboxStore } from "../store/ComboboxStore";

// Word Joiner is invisible and zero-width, so it forces a text mutation without shifting layout.
const LIVE_REGION_MARKER = "⁠";
// Safari VoiceOver needed roughly 200ms to reliably notice the initial polite live-region change.
const LIVE_REGION_TEXT_MUTATION_RESET_DELAY = 200;

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

/**
 * Renders its children only when the list is empty.
 * Requires the `items` prop on the root component.
 * Announces changes politely to screen readers.
 * This component's root element must remain mounted in the DOM to announce
 * changes consistently across screen readers. Avoid hiding or removing the
 * component itself with `display: none`, `hidden`, `aria-hidden`, or conditional
 * rendering. Prefer updating or conditionally rendering its children instead.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxEmpty<T extends JSX.ElementType = "div">(props: ComboboxEmpty.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useComboboxRootContext() as ComboboxStore;
  const derived = useComboboxDerivedItemsContext();

  // Only the initial mounted announcement needs the marker; later text updates announce naturally.
  // Rendered declaratively: reze inserts conditional children after mount callbacks and effects
  // run, so no synchronous hook observes the mounted text (unlike Solid's onSettled). The marker
  // interpolation resolves with the children before first-paint assertions either way, keeping
  // the same textContent semantics: marked on mount, restored after the reset delay.
  const markerState = createStore({ marked: !isIOSDevice() });
  effect(() => {
    const timeoutId = setTimeout(() => {
      untrack(() => {
        markerState.marked = false;
      });
    }, LIVE_REGION_TEXT_MUTATION_RESET_DELAY);
    onCleanup(() => clearTimeout(timeoutId));
  });

  function setEmptyElement(element: HTMLDivElement | null) {
    store.context.emptyRef.current = element;
  }

  function snapshot(): ComboboxEmptyState {
    return {};
  }

  function isEmpty() {
    return derived.filteredItems.length === 0;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(setEmptyElement, props.ref as ((element: HTMLElement | null) => void) | undefined)}
      >
        {isEmpty() ? resolveChildrenValue(children, snapshot) : null}
        {isEmpty() && markerState.marked ? LIVE_REGION_MARKER : null}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={mergeRefs(setEmptyElement, props.ref as ((element: HTMLElement | null) => void) | undefined)}
    >
      {isEmpty() ? resolveChildrenValue(children, snapshot) : null}
      {isEmpty() && markerState.marked ? LIVE_REGION_MARKER : null}
    </Tag>
  );
}

export interface ComboboxEmptyState {}

export type ComboboxEmptyProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ComboboxEmptyState>;

export namespace ComboboxEmpty {
  export type State = ComboboxEmptyState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxEmptyProps<T>;
}

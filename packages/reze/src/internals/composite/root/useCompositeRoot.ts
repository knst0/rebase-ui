import { effect, store, untrack } from "reze-js";

import {
  type CompositeElements,
  type CompositeOrientation,
  COMPOSITE_KEYS,
  type DisabledIndices,
  getMinListIndex,
  isElementDisabled,
  isIndexOutOfListBounds,
  isListIndexDisabled,
  isModifierKeySet,
  isNativeInput,
  type ModifierKey,
  type TextDirection,
} from "../composite";
import { ACTIVE_COMPOSITE_ITEM } from "../constants";
import { createElementRegistry } from "../registry/createElementRegistry";
import { preciseScrollBehavior } from "../scroll/preciseScrollBehavior";
import { type CompositeScrollBehavior } from "../scroll/scrollBehavior";
import type { CompositeItemMetadata, CompositeRootContext } from "./CompositeRootContext";
import type { CompositeGridNavigator } from "./gridNavigation";
import { getNavigationIntent, resolveNextIndex } from "./navigation";

const EMPTY_MODIFIER_KEYS: readonly ModifierKey[] = [];

type ValueOrAccessor<T> = T | (() => T);

export type CompositeOnLoop = (event: KeyboardEvent, prevIndex: number, nextIndex: number, elements: CompositeElements) => number;

export interface UseCompositeRootParameters {
  /**
   * @default 'both'
   */
  orientation?: ValueOrAccessor<CompositeOrientation | undefined>;
  /**
   * Enables grid navigation. Build the navigator with `gridNavigation()`.
   */
  grid?: (() => CompositeGridNavigator | undefined) | undefined;
  /**
   * @default true
   */
  loopFocus?: ValueOrAccessor<boolean | undefined>;
  /**
   * Called when navigation wraps around, to override the index that is highlighted next.
   */
  onLoop?: CompositeOnLoop | undefined;
  /**
   * When `true`, pressing the Home key moves focus to the first item,
   * and pressing the End key moves focus to the last item.
   * @default false
   */
  enableHomeAndEndKeys?: ValueOrAccessor<boolean | undefined>;
  /**
   * @default false
   */
  highlightItemOnHover?: ValueOrAccessor<boolean | undefined>;
  /**
   * When `true`, keypress events on the navigation keys are stopped with `event.stopPropagation()`.
   * @default true
   */
  stopEventPropagation?: ValueOrAccessor<boolean | undefined>;
  /**
   * @default 'ltr'
   */
  direction?: ValueOrAccessor<TextDirection | undefined>;
  highlightedIndex?: ValueOrAccessor<number | undefined>;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  /**
   * Item indices to be considered disabled.
   * Used for composite items that are focusable when disabled.
   */
  disabledIndices?: (() => DisabledIndices | undefined) | undefined;
  /**
   * Modifier keys that should allow normal keyboard actions when pressed.
   * @default []
   */
  modifierKeys?: ValueOrAccessor<readonly ModifierKey[] | undefined>;
  /**
   * Called whenever the set of registered items changes.
   */
  onMapChange?: ((map: Map<HTMLElement, CompositeItemMetadata>) => void) | undefined;
  /**
   * The scroll container used when scrolling the highlighted item into view.
   * Defaults to the composite root element.
   */
  rootRef?: ((element: HTMLElement | null) => void) | undefined;
  /**
   * How the highlighted item is scrolled into view. Defaults to the container-scoped
   * `preciseScrollBehavior` (mirrors upstream `scrollIntoViewIfNeeded`, which only ever
   * scrolls the composite root). Pass `nearestScrollBehavior` to opt into the browser's
   * native `scrollIntoView({ block: 'nearest' })`, which also scrolls page-level ancestors.
   */
  scrollBehavior?: CompositeScrollBehavior | undefined;
}

export interface UseCompositeRootReturnValue {
  contextValue: CompositeRootContext;
  getRootProps: (externalProps?: Record<string, any>) => Record<string, any>;
  rootRef: (element: HTMLElement | null) => void;
  elements: () => HTMLElement[];
  highlightedIndex: () => number;
  setHighlightedIndex: (index: number, shouldScrollIntoView?: boolean) => void;
}

export function useCompositeRoot(parameters: UseCompositeRootParameters = {}): UseCompositeRootReturnValue {
  function orientation(): CompositeOrientation {
    return resolveValueOrAccessor(parameters.orientation) ?? "both";
  }
  function grid(): CompositeGridNavigator | undefined {
    return parameters.grid?.();
  }
  function loopFocus(): boolean {
    return resolveValueOrAccessor(parameters.loopFocus) ?? true;
  }
  function enableHomeAndEndKeys(): boolean {
    return resolveValueOrAccessor(parameters.enableHomeAndEndKeys) ?? false;
  }
  function highlightItemOnHover(): boolean {
    return resolveValueOrAccessor(parameters.highlightItemOnHover) ?? false;
  }
  function stopEventPropagation(): boolean {
    return resolveValueOrAccessor(parameters.stopEventPropagation) ?? true;
  }
  function direction(): TextDirection {
    return resolveValueOrAccessor(parameters.direction) ?? "ltr";
  }
  function disabledIndices(): DisabledIndices | undefined {
    return parameters.disabledIndices?.();
  }
  function modifierKeys(): readonly ModifierKey[] {
    return resolveValueOrAccessor(parameters.modifierKeys) ?? EMPTY_MODIFIER_KEYS;
  }

  const registry = createElementRegistry<CompositeItemMetadata>();
  const elements = registry.elements;

  const state = store({ internalHighlightedIndex: 0 });

  function highlightedIndex(): number {
    return resolveValueOrAccessor(parameters.highlightedIndex) ?? state.internalHighlightedIndex;
  }

  let rootElement: HTMLElement | null = null;
  let highlightedElement: HTMLElement | null = null;
  let tabStopElement: HTMLElement | null = null;

  function scrollHighlightedIntoView(element: HTMLElement | null): void {
    (parameters.scrollBehavior ?? preciseScrollBehavior)({
      container: rootElement,
      element,
      direction: direction(),
      orientation: orientation(),
    });
  }

  function setHighlightedIndex(index: number, shouldScrollIntoView = false): void {
    // Actions never subscribe: the reads below stay one-shot no matter the
    // caller (effect, event handler, or forwarded relay call).
    untrack(() => {
      highlightedElement = elements()[index] ?? null;
      if (state.internalHighlightedIndex !== index) {
        state.internalHighlightedIndex = index;
      }
      parameters.onHighlightedIndexChange?.(index);

      if (shouldScrollIntoView) {
        scrollHighlightedIntoView(elements()[index] ?? null);
      }
    });
  }

  function registerItem(element: HTMLElement, metadata?: CompositeItemMetadata): void {
    registry.register(element, metadata ?? {});
  }

  function metadataMap(): Map<HTMLElement, CompositeItemMetadata> {
    const items = elements();
    const next = new Map<HTMLElement, CompositeItemMetadata>();
    for (const item of items) {
      next.set(item, registry.metadataOf(item) ?? {});
    }
    return next;
  }

  function claimInitialTabIndex(): number {
    // The Reze layer renders on the client: every item starts at `-1` and the
    // root promotes the real tab stop from document order once the elements exist.
    return -1;
  }

  effect(() => {
    const element = elements()[highlightedIndex()] ?? null;

    // The apply half runs one-shot: it only touches the DOM, so the tab-stop
    // bookkeeping never subscribes to the state it derives from.
    untrack(() => {
      if (tabStopElement === element) {
        return;
      }
      tabStopElement?.setAttribute("tabindex", "-1");
      element?.setAttribute("tabindex", "0");
      tabStopElement = element;
    });
  });

  let hasSetDefaultIndex = false;

  effect(() => {
    // Tracked inputs, mirroring the compute half of the split effect.
    const items = elements();
    const map = metadataMap();
    const indices = disabledIndices();

    // Untracked apply half: everything below runs one-shot, so the writes it
    // performs (highlighted index, user callbacks) never resubscribe this effect.
    untrack(() => {
      if (items.length === 0) {
        return;
      }

      parameters.onMapChange?.(map);

      const currentIndex = highlightedIndex();

      if (!hasSetDefaultIndex) {
        hasSetDefaultIndex = true;

        const activeItem = items.find((item) => item.hasAttribute(ACTIVE_COMPOSITE_ITEM)) ?? null;
        const activeIndex = activeItem ? registry.indexOf(activeItem) : -1;

        if (activeIndex !== -1) {
          setHighlightedIndex(activeIndex);
        } else if (isListIndexDisabled(items, currentIndex, indices)) {
          const firstEnabledIndex = getMinListIndex(items, indices);
          if (!isIndexOutOfListBounds(items, firstEnabledIndex)) {
            setHighlightedIndex(firstEnabledIndex);
          }
        }

        scrollHighlightedIntoView(activeItem);
        return;
      }

      // Items added or removed around the highlighted one shift its index, so the tab stop
      // would otherwise move to a different item and navigation would resume from the
      const nextIndex = highlightedElement == null ? -1 : items.indexOf(highlightedElement);

      if (nextIndex === -1) {
        // A replacement at the same index can keep the tab stop. Otherwise move it to an
        // eligible item so a missing, hidden, or disabled replacement does not take the
        // composite out of the tab order.
        const replacement = items[currentIndex];
        if (replacement == null || isListIndexDisabled(items, currentIndex, indices)) {
          setHighlightedIndex(getFallbackIndex(items, indices));
          return;
        }
        highlightedElement = replacement;
      } else if (nextIndex !== currentIndex) {
        setHighlightedIndex(nextIndex);
        return;
      }

      if (indices == null || resolveValueOrAccessor(parameters.highlightedIndex) != null) {
        return;
      }

      if (isListIndexDisabled(items, currentIndex, indices)) {
        const firstEnabledIndex = getMinListIndex(items, indices);
        if (!isIndexOutOfListBounds(items, firstEnabledIndex)) {
          setHighlightedIndex(firstEnabledIndex);
        }
      }
    });
  });

  function rootRef(element: HTMLElement | null): void {
    rootElement = element;
    parameters.rootRef?.(element);
  }

  function onLoop(event: KeyboardEvent, prevIndex: number, nextIndex: number): number {
    if (!parameters.onLoop) {
      return nextIndex;
    }
    return parameters.onLoop(event, prevIndex, nextIndex, untrack(elements));
  }

  function onKeyDown(event: KeyboardEvent): void {
    const currentOrientation = orientation();
    const currentDirection = direction();
    const homeAndEndEnabled = enableHomeAndEndKeys();
    const intent = getNavigationIntent(event, currentOrientation, currentDirection);

    if (!COMPOSITE_KEYS.has(event.key) || (!homeAndEndEnabled && intent.isHomeOrEndKey)) {
      return;
    }

    if (isModifierKeySet(event, modifierKeys())) {
      return;
    }

    const items = elements();
    if (rootElement === null || items.length === 0) {
      return;
    }

    if (shouldDeferToNativeInput(event, intent.forwardKey, intent.backwardKey)) {
      return;
    }

    const resolution = resolveNextIndex({
      direction: currentDirection,
      disabledIndices: disabledIndices(),
      elements: items,
      enableHomeAndEndKeys: homeAndEndEnabled,
      event,
      grid: grid(),
      highlightedIndex: highlightedIndex(),
      loopFocus: loopFocus(),
      onLoop,
      orientation: currentOrientation,
    });

    if (!resolution.handled) {
      return;
    }

    if (stopEventPropagation()) {
      event.stopPropagation();
    }

    if (resolution.shouldPreventDefault) {
      event.preventDefault();
    }

    setHighlightedIndex(resolution.nextIndex, true);

    // Every registered item carries a tab stop from render (`-1` at minimum, `0`
    // once promoted), so the newly highlighted item is focusable even before the
    // tab-stop effect above applies its promotion.
    items[resolution.nextIndex]?.focus();
  }

  function onFocus(event: FocusEvent): void {
    const target = event.target;
    if (rootElement === null || target == null || !isNativeInput(target)) {
      return;
    }
    target.setSelectionRange(0, target.value.length);
  }

  function getRootProps(externalProps: Record<string, any> = {}): Record<string, any> {
    const props: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onKeyDown" || key === "onFocus") {
        continue;
      }
      Object.defineProperty(props, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    props.onKeyDown = (event: KeyboardEvent) => {
      externalProps.onKeyDown?.(event);
      onKeyDown(event);
    };

    props.onFocus = (event: FocusEvent) => {
      externalProps.onFocus?.(event);
      onFocus(event);
    };

    return props;
  }

  const contextValue: CompositeRootContext = {
    highlightedIndex,
    setHighlightedIndex,
    highlightItemOnHover,
    elements,
    metadataMap,
    indexOf: registry.indexOf,
    claimInitialTabIndex,
    registerItem,
    unregisterItem: registry.unregister,
    relayKeyboardEvent: onKeyDown,
  };

  return { contextValue, getRootProps, rootRef, elements, highlightedIndex, setHighlightedIndex };
}

/** Returns `true` when the key should fall through to native textbox behavior. */
function shouldDeferToNativeInput(event: KeyboardEvent, forwardKey: string, backwardKey: string): boolean {
  const target = event.target;
  if (target == null || !isNativeInput(target) || isElementDisabled(target)) {
    return false;
  }

  const selectionStart = target.selectionStart;
  const selectionEnd = target.selectionEnd;

  if (selectionStart == null || event.shiftKey || selectionStart !== selectionEnd) {
    return true;
  }

  if (event.key !== backwardKey && selectionStart < target.value.length) {
    return true;
  }

  if (event.key !== forwardKey && selectionStart > 0) {
    return true;
  }

  return false;
}

// Resolves the item that should hold the tab stop: the active item when it can take focus,
// otherwise the first item that can. Falls back to index 0 so an all-disabled composite keeps
// the index in range and regains a tab stop as soon as one of its items becomes focusable.
function getFallbackIndex(elements: CompositeElements, disabledIndices?: DisabledIndices): number {
  let fallbackIndex = -1;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];

    if (!element || isListIndexDisabled(elements, index, disabledIndices)) {
      continue;
    }

    if (element.hasAttribute(ACTIVE_COMPOSITE_ITEM)) {
      return index;
    }

    if (fallbackIndex === -1) {
      fallbackIndex = index;
    }
  }

  return Math.max(fallbackIndex, 0);
}

function resolveValueOrAccessor<T>(value: ValueOrAccessor<T> | undefined): T | undefined {
  return typeof value === "function" ? (value as () => T)() : value;
}

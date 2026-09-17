import { isServer } from "@solidjs/web";
import { createEffect, createMemo, createSignal, flush, untrack } from "solid-js";

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
  const orientation = () => resolveValueOrAccessor(parameters.orientation) ?? "both";
  const grid = () => parameters.grid?.();
  const loopFocus = () => resolveValueOrAccessor(parameters.loopFocus) ?? true;
  const enableHomeAndEndKeys = () => resolveValueOrAccessor(parameters.enableHomeAndEndKeys) ?? false;
  const highlightItemOnHover = () => resolveValueOrAccessor(parameters.highlightItemOnHover) ?? false;
  const stopEventPropagation = () => resolveValueOrAccessor(parameters.stopEventPropagation) ?? true;
  const direction = () => resolveValueOrAccessor(parameters.direction) ?? "ltr";
  const disabledIndices = () => parameters.disabledIndices?.();
  const modifierKeys = () => resolveValueOrAccessor(parameters.modifierKeys) ?? EMPTY_MODIFIER_KEYS;

  const registry = createElementRegistry<CompositeItemMetadata>();
  const elements = registry.elements;

  const [internalHighlightedIndex, setInternalHighlightedIndex] = createSignal(0);

  const highlightedIndex = () => resolveValueOrAccessor(parameters.highlightedIndex) ?? internalHighlightedIndex();

  let rootElement: HTMLElement | null = null;

  const scrollHighlightedIntoView = (element: HTMLElement | null) => {
    (parameters.scrollBehavior ?? preciseScrollBehavior)({
      container: rootElement,
      element,
      direction: untrack(direction),
      orientation: untrack(orientation),
    });
  };

  const setHighlightedIndex = (index: number, shouldScrollIntoView = false) => {
    setInternalHighlightedIndex(index);
    parameters.onHighlightedIndexChange?.(index);

    if (shouldScrollIntoView) {
      scrollHighlightedIntoView(untrack(elements)[index] ?? null);
    }
  };

  const registerItem = (element: HTMLElement, metadata?: CompositeItemMetadata) => {
    registry.register(element, metadata ?? {});
  };

  const metadataMap = createMemo(() => {
    const items = elements();
    const next = new Map<HTMLElement, CompositeItemMetadata>();
    for (const item of items) {
      next.set(item, registry.metadataOf(item) ?? {});
    }
    return next;
  });

  let claimedTabStops = 0;

  const claimInitialTabIndex = () => {
    if (!isServer) {
      return -1;
    }
    return claimedTabStops++ === untrack(highlightedIndex) ? 0 : -1;
  };

  let tabStopElement: HTMLElement | null = null;

  createEffect(
    () => elements()[highlightedIndex()] ?? null,
    (element) => {
      if (tabStopElement === element) {
        return;
      }
      tabStopElement?.setAttribute("tabindex", "-1");
      element?.setAttribute("tabindex", "0");
      tabStopElement = element;
    },
  );

  let hasSetDefaultIndex = false;

  createEffect(
    () => ({ items: elements(), map: metadataMap(), indices: disabledIndices() }),
    ({ items, map }) => {
      if (items.length === 0) {
        return;
      }

      parameters.onMapChange?.(map);

      const indices = untrack(disabledIndices);
      const currentIndex = untrack(highlightedIndex);

      if (!hasSetDefaultIndex) {
        hasSetDefaultIndex = true;

        const activeItem = items.find((item) => item.hasAttribute(ACTIVE_COMPOSITE_ITEM)) ?? null;
        const activeIndex = activeItem ? untrack(() => registry.indexOf(activeItem)) : -1;

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

      if (indices == null || resolveValueOrAccessor(parameters.highlightedIndex) != null) {
        return;
      }

      if (isListIndexDisabled(items, currentIndex, indices)) {
        const firstEnabledIndex = getMinListIndex(items, indices);
        if (!isIndexOutOfListBounds(items, firstEnabledIndex)) {
          setHighlightedIndex(firstEnabledIndex);
        }
      }
    },
  );

  const rootRef = (element: HTMLElement | null) => {
    rootElement = element;
    parameters.rootRef?.(element);
  };

  const onLoop = (event: KeyboardEvent, prevIndex: number, nextIndex: number): number => {
    if (!parameters.onLoop) {
      return nextIndex;
    }
    return parameters.onLoop(event, prevIndex, nextIndex, untrack(elements));
  };

  const onKeyDown = (event: KeyboardEvent) => {
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
    flush();

    items[resolution.nextIndex]?.focus();
  };

  const onFocus = (event: FocusEvent) => {
    const target = event.target;
    if (rootElement === null || target == null || !isNativeInput(target)) {
      return;
    }
    target.setSelectionRange(0, target.value.length);
  };

  const getRootProps = (externalProps: Record<string, any> = {}): Record<string, any> => {
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
  };

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

function resolveValueOrAccessor<T>(value: ValueOrAccessor<T> | undefined): T | undefined {
  return typeof value === "function" ? (value as () => T)() : value;
}

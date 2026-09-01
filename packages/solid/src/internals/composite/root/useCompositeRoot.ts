import { createEffect, createSignal, flush, untrack } from "solid-js";

import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  type CompositeElements,
  type CompositeOrientation,
  COMPOSITE_KEYS,
  type DisabledIndices,
  END,
  findNonDisabledListIndex,
  getMaxListIndex,
  getMinListIndex,
  HOME,
  isElementDisabled,
  isIndexOutOfListBounds,
  isListIndexDisabled,
  isModifierKeySet,
  isNativeInput,
  type ModifierKey,
  scrollIntoViewIfNeeded,
  sortByDocumentPosition,
  type TextDirection,
} from "../composite";
import { ACTIVE_COMPOSITE_ITEM } from "../constants";
import type { CompositeItemMetadata, CompositeRootContext } from "./CompositeRootContext";
import type { CompositeGridNavigator } from "./gridNavigation";

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

  const [elements, setElements] = createSignal<HTMLElement[]>([]);
  const [metadataMap, setMetadataMap] = createSignal(new Map<HTMLElement, CompositeItemMetadata>());
  const [internalHighlightedIndex, setInternalHighlightedIndex] = createSignal(0);

  const highlightedIndex = () => resolveValueOrAccessor(parameters.highlightedIndex) ?? internalHighlightedIndex();

  let rootElement: HTMLElement | null = null;

  const setHighlightedIndex = (index: number, shouldScrollIntoView = false) => {
    setInternalHighlightedIndex(index);
    parameters.onHighlightedIndexChange?.(index);

    if (shouldScrollIntoView) {
      scrollIntoViewIfNeeded(rootElement, untrack(elements)[index] ?? null, direction(), orientation());
    }
  };

  const registerItem = (element: HTMLElement, metadata?: CompositeItemMetadata) => {
    setMetadataMap((previous) => {
      const next = new Map(previous);
      next.set(element, metadata ?? {});
      return next;
    });
    setElements((previous) => sortByDocumentPosition(previous, element));
  };

  const unregisterItem = (element: HTMLElement) => {
    setMetadataMap((previous) => {
      if (!previous.has(element)) {
        return previous;
      }
      const next = new Map(previous);
      next.delete(element);
      return next;
    });
    setElements((previous) => previous.filter((current) => current !== element));
  };

  let hasSetDefaultIndex = false;

  createEffect(
    () => ({ items: elements(), map: metadataMap(), indices: disabledIndices() }),
    ({ items, map }) => {
      if (items.length === 0) {
        return;
      }

      const sortedMap = new Map<HTMLElement, CompositeItemMetadata>();
      for (const item of items) {
        sortedMap.set(item, map.get(item) ?? {});
      }
      parameters.onMapChange?.(sortedMap);

      const indices = untrack(disabledIndices);
      const currentIndex = untrack(highlightedIndex);

      if (!hasSetDefaultIndex) {
        hasSetDefaultIndex = true;

        const activeItem = items.find((item) => item.hasAttribute(ACTIVE_COMPOSITE_ITEM)) ?? null;
        const activeIndex = activeItem ? items.indexOf(activeItem) : -1;

        if (activeIndex !== -1) {
          setHighlightedIndex(activeIndex);
        } else if (isListIndexDisabled(items, currentIndex, indices)) {
          // The default highlighted item is disabled, so it should not hold the single
          // roving tab stop: a natively disabled element is removed from the tab order,
          // and an aria-disabled one should not be the entry point. Move the tab stop to
          // the first enabled item. If every item is disabled, keep the current index.
          const firstEnabledIndex = getMinListIndex(items, indices);
          if (!isIndexOutOfListBounds(items, firstEnabledIndex)) {
            setHighlightedIndex(firstEnabledIndex);
          }
        }

        scrollIntoViewIfNeeded(rootElement, activeItem, direction(), orientation());
        return;
      }

      // `disabledIndices` can resolve after the initial registration, so the current tab
      // stop may now point at a disabled item, leaving the composite without a reachable
      // tab stop. Re-validate and move it to the first enabled item.
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
    const isHomeOrEnd = event.key === HOME || event.key === END;

    if (!COMPOSITE_KEYS.has(event.key) || (!enableHomeAndEndKeys() && isHomeOrEnd)) {
      return;
    }

    if (isModifierKeySet(event, modifierKeys())) {
      return;
    }

    const items = elements();
    if (rootElement === null || items.length === 0) {
      return;
    }

    const isRtl = direction() === "rtl";
    const currentOrientation = orientation();
    const indices = disabledIndices();

    const horizontalForwardKey = isRtl ? ARROW_LEFT : ARROW_RIGHT;
    const horizontalBackwardKey = isRtl ? ARROW_RIGHT : ARROW_LEFT;
    const forwardKey = currentOrientation === "vertical" ? ARROW_DOWN : horizontalForwardKey;
    const backwardKey = currentOrientation === "vertical" ? ARROW_UP : horizontalBackwardKey;

    const target = event.target;
    if (target != null && isNativeInput(target) && !isElementDisabled(target)) {
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      const textContent = target.value;

      // Return to native textbox behavior when
      // 1 - Shift is held to make a text selection, or if there already is a text selection
      if (selectionStart == null || event.shiftKey || selectionStart !== selectionEnd) {
        return;
      }
      // 2 - arrow-ing forward and not in the last position of the text
      if (event.key !== backwardKey && selectionStart < textContent.length) {
        return;
      }
      // 3 - arrow-ing backward and not in the first position of the text
      if (event.key !== forwardKey && selectionStart > 0) {
        return;
      }
    }

    const currentIndex = highlightedIndex();
    const minIndex = getMinListIndex(items, indices);
    const maxIndex = getMaxListIndex(items, indices);

    let nextIndex = currentIndex;

    const gridNavigator = grid();
    const isGrid = gridNavigator != null;

    if (gridNavigator != null) {
      nextIndex = gridNavigator({
        disabledIndices: indices,
        elements: items,
        event,
        highlightedIndex: currentIndex,
        loopFocus: loopFocus(),
        maxIndex,
        minIndex,
        onLoop,
        orientation: currentOrientation,
        rtl: isRtl,
      });
    }

    const isForwardKey =
      (currentOrientation !== "vertical" && event.key === horizontalForwardKey) ||
      (currentOrientation !== "horizontal" && event.key === ARROW_DOWN);
    const isBackwardKey =
      (currentOrientation !== "vertical" && event.key === horizontalBackwardKey) ||
      (currentOrientation !== "horizontal" && event.key === ARROW_UP);

    if (enableHomeAndEndKeys()) {
      if (event.key === HOME) {
        nextIndex = minIndex;
      } else if (event.key === END) {
        nextIndex = maxIndex;
      }
    }

    if (nextIndex === currentIndex && (isForwardKey || isBackwardKey)) {
      if (loopFocus() && nextIndex === maxIndex && isForwardKey) {
        nextIndex = onLoop(event, currentIndex, minIndex);
      } else if (loopFocus() && nextIndex === minIndex && isBackwardKey) {
        nextIndex = onLoop(event, currentIndex, maxIndex);
      } else {
        nextIndex = findNonDisabledListIndex(items, {
          startingIndex: nextIndex,
          decrement: isBackwardKey,
          disabledIndices: indices,
        });
      }
    }

    if (nextIndex === currentIndex || isIndexOutOfListBounds(items, nextIndex)) {
      return;
    }

    if (stopEventPropagation()) {
      event.stopPropagation();
    }

    if (isGrid || isHomeOrEnd || isForwardKey || isBackwardKey) {
      event.preventDefault();
    }

    setHighlightedIndex(nextIndex, true);
    flush();

    items[nextIndex]?.focus();
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
    registerItem,
    unregisterItem,
    relayKeyboardEvent: onKeyDown,
  };

  return { contextValue, getRootProps, rootRef, elements, highlightedIndex, setHighlightedIndex };
}

function resolveValueOrAccessor<T>(value: ValueOrAccessor<T> | undefined): T | undefined {
  return typeof value === "function" ? (value as () => T)() : value;
}

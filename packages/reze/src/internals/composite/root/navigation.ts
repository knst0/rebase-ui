import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  type CompositeElements,
  type CompositeOrientation,
  type DisabledIndices,
  END,
  findNonDisabledListIndex,
  getMaxListIndex,
  getMinListIndex,
  HOME,
  isIndexOutOfListBounds,
  type TextDirection,
} from "../composite";
import type { CompositeGridNavigator } from "./gridNavigation";

export interface ResolveNextIndexOptions {
  event: KeyboardEvent;
  elements: CompositeElements;
  highlightedIndex: number;
  orientation: CompositeOrientation;
  direction: TextDirection;
  loopFocus: boolean;
  enableHomeAndEndKeys: boolean;
  disabledIndices: DisabledIndices | undefined;
  grid: CompositeGridNavigator | undefined;
  onLoop: (event: KeyboardEvent, prevIndex: number, nextIndex: number) => number;
}

export interface NavigationIntent {
  /** Key resolves along the composite's main axis in the forward direction. */
  isForwardKey: boolean;
  isBackwardKey: boolean;
  isHomeOrEndKey: boolean;
  forwardKey: string;
  backwardKey: string;
}

export interface NavigationResolution {
  nextIndex: number;
  /** `false` when the key is a no-op and the event should be left alone. */
  handled: boolean;
  shouldPreventDefault: boolean;
}

export function getNavigationIntent(event: KeyboardEvent, orientation: CompositeOrientation, direction: TextDirection): NavigationIntent {
  const isRtl = direction === "rtl";
  const horizontalForwardKey = isRtl ? ARROW_LEFT : ARROW_RIGHT;
  const horizontalBackwardKey = isRtl ? ARROW_RIGHT : ARROW_LEFT;

  return {
    forwardKey: orientation === "vertical" ? ARROW_DOWN : horizontalForwardKey,
    backwardKey: orientation === "vertical" ? ARROW_UP : horizontalBackwardKey,
    isForwardKey:
      (orientation !== "vertical" && event.key === horizontalForwardKey) || (orientation !== "horizontal" && event.key === ARROW_DOWN),
    isBackwardKey:
      (orientation !== "vertical" && event.key === horizontalBackwardKey) || (orientation !== "horizontal" && event.key === ARROW_UP),
    isHomeOrEndKey: event.key === HOME || event.key === END,
  };
}

export function resolveNextIndex(options: ResolveNextIndexOptions): NavigationResolution {
  const { direction, disabledIndices, elements, enableHomeAndEndKeys, event, grid, highlightedIndex, loopFocus, onLoop, orientation } =
    options;

  const intent = getNavigationIntent(event, orientation, direction);
  const minIndex = getMinListIndex(elements, disabledIndices);
  const maxIndex = getMaxListIndex(elements, disabledIndices);

  let nextIndex = highlightedIndex;

  if (grid !== undefined) {
    nextIndex = grid({
      disabledIndices,
      elements,
      event,
      highlightedIndex,
      loopFocus,
      maxIndex,
      minIndex,
      onLoop,
      orientation,
      rtl: direction === "rtl",
    });
  }

  if (enableHomeAndEndKeys) {
    if (event.key === HOME) {
      nextIndex = minIndex;
    } else if (event.key === END) {
      nextIndex = maxIndex;
    }
  }

  if (nextIndex === highlightedIndex && (intent.isForwardKey || intent.isBackwardKey)) {
    if (loopFocus && nextIndex === maxIndex && intent.isForwardKey) {
      nextIndex = onLoop(event, highlightedIndex, minIndex);
    } else if (loopFocus && nextIndex === minIndex && intent.isBackwardKey) {
      nextIndex = onLoop(event, highlightedIndex, maxIndex);
    } else {
      nextIndex = findNonDisabledListIndex(elements, {
        startingIndex: nextIndex,
        decrement: intent.isBackwardKey,
        disabledIndices,
      });
    }
  }

  if (nextIndex === highlightedIndex || isIndexOutOfListBounds(elements, nextIndex)) {
    return { nextIndex: highlightedIndex, handled: false, shouldPreventDefault: false };
  }

  return {
    nextIndex,
    handled: true,
    shouldPreventDefault: grid !== undefined || intent.isHomeOrEndKey || intent.isForwardKey || intent.isBackwardKey,
  };
}

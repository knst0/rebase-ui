import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  type CompositeElements,
  type CompositeOrientation,
  type DisabledIndices,
  isListIndexDisabled,
} from "../composite";
import {
  createGridCellMap,
  getGridCellIndexOfCorner,
  getGridCellIndices,
  getGridNavigatedIndex,
  type GridItemSize,
  type GridOnLoop,
} from "../grid";

export interface CompositeGridConfig {
  cols: number;
  dense?: boolean | undefined;
  itemSizes?: GridItemSize[] | undefined;
}

export interface CompositeGridNavigationState {
  event: KeyboardEvent;
  elements: CompositeElements;
  highlightedIndex: number;
  minIndex: number;
  maxIndex: number;
  orientation: CompositeOrientation;
  loopFocus: boolean;
  onLoop?: GridOnLoop | undefined;
  disabledIndices?: DisabledIndices | undefined;
  rtl: boolean;
}

export type CompositeGridNavigator = (state: CompositeGridNavigationState) => number;

/**
 * Builds the grid navigation handler passed to `CompositeRoot`/`useCompositeRoot`
 * via the `grid` prop. Importing and calling this is the opt-in for grid navigation:
 * composites that don't pass `grid` never reference the algorithm, so bundlers
 * tree-shake the grid helpers out.
 */
export function gridNavigation(config: CompositeGridConfig): CompositeGridNavigator {
  const { cols, dense = false, itemSizes } = config;

  return (state) => {
    const { disabledIndices, elements, event, highlightedIndex, loopFocus, maxIndex, minIndex, onLoop, orientation, rtl } = state;

    const sizes = itemSizes || Array.from({ length: elements.length }, () => ({ width: 1, height: 1 }));

    // Work in hypothetical 1x1 cell indices, then convert back to item indices.
    const cellMap = createGridCellMap(sizes, cols, dense);
    const minGridIndex = cellMap.findIndex((index) => index != null && !isListIndexDisabled(elements, index, disabledIndices));
    const maxGridIndex = cellMap.reduce(
      (foundIndex: number, index, cellIndex) =>
        index != null && !isListIndexDisabled(elements, index, disabledIndices) ? cellIndex : foundIndex,
      -1,
    );

    const cellIndex = getGridNavigatedIndex(
      cellMap.map((itemIndex) => (itemIndex != null ? elements[itemIndex] : null)),
      {
        event,
        orientation,
        loopFocus,
        onLoop,
        cols,
        // Treat undefined gaps as disabled so navigation cannot land in them.
        disabledIndices: getGridCellIndices(
          [
            ...(toIndexList(disabledIndices, elements) ??
              elements.map((_, index) => (isListIndexDisabled(elements, index) ? index : undefined))),
            undefined,
          ],
          cellMap,
        ),
        minIndex: minGridIndex,
        maxIndex: maxGridIndex,
        prevIndex: getGridCellIndexOfCorner(
          highlightedIndex > maxIndex ? minIndex : highlightedIndex,
          sizes,
          cellMap,
          cols,
          // Choose the corner closest to the movement direction so spanning items
          // do not immediately resolve back to themselves.
          event.key === ARROW_DOWN ? "bl" : event.key === (rtl ? ARROW_LEFT : ARROW_RIGHT) ? "tr" : "tl",
        ),
        rtl,
      },
    );

    return cellMap[cellIndex] as number;
  };
}

function toIndexList(disabledIndices: DisabledIndices | undefined, elements: CompositeElements): number[] | undefined {
  if (disabledIndices === undefined) {
    return undefined;
  }
  if (typeof disabledIndices === "function") {
    return elements.flatMap((_, index) => (disabledIndices(index) ? [index] : []));
  }
  return [...disabledIndices];
}

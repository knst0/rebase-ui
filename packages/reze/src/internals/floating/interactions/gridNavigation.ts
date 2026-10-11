import { isIndexOutOfListBounds, type DisabledIndices } from "../../composite/composite";
import { getGridNavigatedIndex } from "../../composite/grid";

/**
 * Computes two-dimensional list navigation for grid-capable consumers.
 * Solid port of upstream `gridNavigation` (mui/base-ui v1.8.0).
 * Positional arguments are deliberate: property names of an options object
 * don't minify, and the signature is locked to the caller via the `grid`
 * option of `createListNavigation`. Uses native `KeyboardEvent` and a plain
 * list-holder instead of React refs.
 */
export function gridNavigation(
  event: KeyboardEvent,
  prevIndex: number,
  listRef: { current: Array<HTMLElement | null> },
  orientation: "horizontal" | "vertical" | "both",
  loopFocus: boolean,
  rtl: boolean,
  disabledIndices: DisabledIndices | undefined,
  minIndex: number,
  maxIndex: number,
  cols = 2,
): number | undefined {
  const nextIndex = getGridNavigatedIndex(listRef.current, {
    event,
    orientation,
    loopFocus,
    rtl,
    cols,
    disabledIndices,
    minIndex,
    maxIndex,
    // An out-of-range previous index falls back to the first enabled item.
    prevIndex: prevIndex > maxIndex ? minIndex : prevIndex,
    stopEvent: true,
  });

  // `getGridNavigatedIndex` can return an out-of-bounds sentinel when there is
  // no previous item to move from; surface that as `undefined` so the caller
  // treats it as "no navigation" rather than highlighting index `-1`.
  return isIndexOutOfListBounds(listRef.current, nextIndex) ? undefined : nextIndex;
}

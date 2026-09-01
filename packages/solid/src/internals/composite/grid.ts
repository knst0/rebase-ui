import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  type CompositeElements,
  type CompositeOrientation,
  type DisabledIndices,
  findNonDisabledListIndex,
  isIndexOutOfListBounds,
  isListIndexDisabled,
  stopEvent,
} from "./composite";

export interface GridItemSize {
  width: number;
  height: number;
}

export type GridOnLoop = (event: KeyboardEvent, prevIndex: number, nextIndex: number) => number;

export function isDifferentGridRow(index: number, cols: number, prevRow: number): boolean {
  return Math.floor(index / cols) !== prevRow;
}

/** For each cell index, gets the item index that occupies that cell. */
export function createGridCellMap(sizes: GridItemSize[], cols: number, dense: boolean): (number | undefined)[] {
  const cellMap: (number | undefined)[] = [];
  let startIndex = 0;

  sizes.forEach(({ width, height }, index) => {
    if (width > cols && process.env.NODE_ENV !== "production") {
      throw new Error(`Rebase UI: Invalid grid - item width at index ${index} is greater than grid columns`);
    }

    let itemPlaced = false;
    if (dense) {
      startIndex = 0;
    }

    while (!itemPlaced) {
      const targetCells: number[] = [];
      for (let i = 0; i < width; i += 1) {
        for (let j = 0; j < height; j += 1) {
          targetCells.push(startIndex + i + j * cols);
        }
      }

      if ((startIndex % cols) + width <= cols && targetCells.every((cell) => cellMap[cell] == null)) {
        for (const cell of targetCells) {
          cellMap[cell] = index;
        }
        itemPlaced = true;
      } else {
        startIndex += 1;
      }
    }
  });

  return [...cellMap];
}

/** Gets the cell index of an item's corner, or -1 when the index is -1. */
export function getGridCellIndexOfCorner(
  index: number,
  sizes: GridItemSize[],
  cellMap: (number | undefined)[],
  cols: number,
  corner: "tl" | "tr" | "bl" | "br",
): number {
  if (index === -1) {
    return -1;
  }

  const firstCellIndex = cellMap.indexOf(index);
  const sizeItem = sizes[index];

  switch (corner) {
    case "tl":
      return firstCellIndex;
    case "tr":
      return sizeItem ? firstCellIndex + sizeItem.width - 1 : firstCellIndex;
    case "bl":
      return sizeItem ? firstCellIndex + (sizeItem.height - 1) * cols : firstCellIndex;
    case "br":
      return cellMap.lastIndexOf(index);
    default:
      return -1;
  }
}

/** Gets all cell indices that correspond to the specified item indices. */
export function getGridCellIndices(indices: (number | undefined)[], cellMap: (number | undefined)[]): number[] {
  return cellMap.flatMap((index, cellIndex) => (indices.includes(index) ? [cellIndex] : []));
}

export interface GetGridNavigatedIndexOptions {
  event: KeyboardEvent;
  orientation: CompositeOrientation;
  loopFocus: boolean;
  onLoop?: GridOnLoop | undefined;
  rtl: boolean;
  cols: number;
  disabledIndices: DisabledIndices | undefined;
  minIndex: number;
  maxIndex: number;
  prevIndex: number;
  stopEvent?: boolean | undefined;
}

export function getGridNavigatedIndex(list: CompositeElements, options: GetGridNavigatedIndexOptions): number {
  const {
    event,
    orientation,
    loopFocus,
    onLoop,
    rtl,
    cols,
    disabledIndices,
    minIndex,
    maxIndex,
    prevIndex,
    stopEvent: stop = false,
  } = options;

  let nextIndex = prevIndex;

  let verticalDirection: "up" | "down" | undefined;
  if (event.key === ARROW_UP) {
    verticalDirection = "up";
  } else if (event.key === ARROW_DOWN) {
    verticalDirection = "down";
  }

  if (verticalDirection) {
    const rows: number[][] = [];
    const rowIndexMap: number[] = [];
    let hasRoleRow = false;
    let visibleItemCount = 0;

    let currentRowElement: Element | null = null;
    let currentRowIndex = -1;

    list.forEach((element, index) => {
      if (element == null) {
        return;
      }

      visibleItemCount += 1;

      const rowElement = element.closest('[role="row"]');
      if (rowElement) {
        hasRoleRow = true;
      }

      if (rowElement !== currentRowElement || currentRowIndex === -1) {
        currentRowElement = rowElement;
        currentRowIndex += 1;
        rows[currentRowIndex] = [];
      }

      rows[currentRowIndex].push(index);
      rowIndexMap[index] = currentRowIndex;
    });

    let hasDomRows = false;
    let inferredDomCols = 0;

    if (hasRoleRow) {
      for (const row of rows) {
        if (row.length > inferredDomCols) {
          inferredDomCols = row.length;
        }
        if (row.length !== cols) {
          hasDomRows = true;
        }
      }
    }

    const hasVirtualizedGaps = hasDomRows && visibleItemCount < list.length;
    const verticalCols = inferredDomCols || cols;

    const navigateVertically = (direction: "up" | "down") => {
      if (!hasDomRows || prevIndex === -1) {
        return undefined;
      }

      const currentRow = rowIndexMap[prevIndex];
      if (currentRow == null) {
        return undefined;
      }

      const colInRow = rows[currentRow].indexOf(prevIndex);
      const step = direction === "up" ? -1 : 1;

      for (let nextRow = currentRow + step, i = 0; i < rows.length; i += 1, nextRow += step) {
        if (nextRow < 0 || nextRow >= rows.length) {
          if (!loopFocus || hasVirtualizedGaps) {
            return undefined;
          }
          nextRow = nextRow < 0 ? rows.length - 1 : 0;
          if (onLoop) {
            const clampedCol = Math.min(colInRow, rows[nextRow].length - 1);
            const targetItemIndex = rows[nextRow][clampedCol] ?? rows[nextRow][0];
            const returnedItemIndex = onLoop(event, prevIndex, targetItemIndex);
            nextRow = rowIndexMap[returnedItemIndex] ?? nextRow;
          }
        }

        const targetRow = rows[nextRow];
        for (let col = Math.min(colInRow, targetRow.length - 1); col >= 0; col -= 1) {
          const candidate = targetRow[col];
          if (!isListIndexDisabled(list, candidate, disabledIndices)) {
            return candidate;
          }
        }
      }

      return undefined;
    };

    const navigateVerticallyWithInferredRows = (direction: "up" | "down") => {
      if (!hasVirtualizedGaps || prevIndex === -1) {
        return undefined;
      }

      const colInRow = prevIndex % verticalCols;
      const rowStep = direction === "up" ? -verticalCols : verticalCols;
      const lastRowStart = maxIndex - (maxIndex % verticalCols);
      const rowCount = Math.floor(maxIndex / verticalCols) + 1;

      for (let rowStart = prevIndex - colInRow + rowStep, i = 0; i < rowCount; i += 1, rowStart += rowStep) {
        if (rowStart < 0 || rowStart > maxIndex) {
          if (!loopFocus) {
            return undefined;
          }
          rowStart = rowStart < 0 ? lastRowStart : 0;
        }

        const rowEnd = Math.min(rowStart + verticalCols - 1, maxIndex);
        for (let candidate = Math.min(rowStart + colInRow, rowEnd); candidate >= rowStart; candidate -= 1) {
          if (!isListIndexDisabled(list, candidate, disabledIndices)) {
            return candidate;
          }
        }
      }

      return undefined;
    };

    if (stop) {
      stopEvent(event);
    }

    const verticalCandidate = navigateVertically(verticalDirection) ?? navigateVerticallyWithInferredRows(verticalDirection);

    if (verticalCandidate !== undefined) {
      nextIndex = verticalCandidate;
    } else if (prevIndex === -1) {
      nextIndex = verticalDirection === "up" ? maxIndex : minIndex;
    } else {
      nextIndex = findNonDisabledListIndex(list, {
        startingIndex: prevIndex,
        amount: verticalCols,
        decrement: verticalDirection === "up",
        disabledIndices,
      });

      if (loopFocus) {
        if (verticalDirection === "up" && (prevIndex - verticalCols < minIndex || nextIndex < 0)) {
          const col = prevIndex % verticalCols;
          const maxCol = maxIndex % verticalCols;
          const offset = maxIndex - (maxCol - col);

          if (maxCol === col) {
            nextIndex = maxIndex;
          } else {
            nextIndex = maxCol > col ? offset : offset - verticalCols;
          }

          if (onLoop) {
            nextIndex = onLoop(event, prevIndex, nextIndex);
          }
        }

        if (verticalDirection === "down" && prevIndex + verticalCols > maxIndex) {
          nextIndex = findNonDisabledListIndex(list, {
            startingIndex: (prevIndex % verticalCols) - verticalCols,
            amount: verticalCols,
            disabledIndices,
          });

          if (onLoop) {
            nextIndex = onLoop(event, prevIndex, nextIndex);
          }
        }
      }
    }

    if (isIndexOutOfListBounds(list, nextIndex)) {
      nextIndex = prevIndex;
    }
  }

  if (orientation === "both") {
    const prevRow = Math.floor(prevIndex / cols);

    if (event.key === (rtl ? ARROW_LEFT : ARROW_RIGHT)) {
      if (stop) {
        stopEvent(event);
      }

      if (prevIndex % cols !== cols - 1) {
        nextIndex = findNonDisabledListIndex(list, { startingIndex: prevIndex, disabledIndices });

        if (loopFocus && isDifferentGridRow(nextIndex, cols, prevRow)) {
          nextIndex = findNonDisabledListIndex(list, {
            startingIndex: prevIndex - (prevIndex % cols) - 1,
            disabledIndices,
          });
          if (onLoop) {
            nextIndex = onLoop(event, prevIndex, nextIndex);
          }
        }
      } else if (loopFocus) {
        nextIndex = findNonDisabledListIndex(list, {
          startingIndex: prevIndex - (prevIndex % cols) - 1,
          disabledIndices,
        });
        if (onLoop) {
          nextIndex = onLoop(event, prevIndex, nextIndex);
        }
      }

      if (isDifferentGridRow(nextIndex, cols, prevRow)) {
        nextIndex = prevIndex;
      }
    }

    if (event.key === (rtl ? ARROW_RIGHT : ARROW_LEFT)) {
      if (stop) {
        stopEvent(event);
      }

      if (prevIndex % cols !== 0) {
        nextIndex = findNonDisabledListIndex(list, { startingIndex: prevIndex, decrement: true, disabledIndices });

        if (loopFocus && isDifferentGridRow(nextIndex, cols, prevRow)) {
          nextIndex = findNonDisabledListIndex(list, {
            startingIndex: prevIndex + (cols - (prevIndex % cols)),
            decrement: true,
            disabledIndices,
          });
          if (onLoop) {
            nextIndex = onLoop(event, prevIndex, nextIndex);
          }
        }
      } else if (loopFocus) {
        nextIndex = findNonDisabledListIndex(list, {
          startingIndex: prevIndex + (cols - (prevIndex % cols)),
          decrement: true,
          disabledIndices,
        });
        if (onLoop) {
          nextIndex = onLoop(event, prevIndex, nextIndex);
        }
      }

      if (isDifferentGridRow(nextIndex, cols, prevRow)) {
        nextIndex = prevIndex;
      }
    }

    const lastRow = Math.floor(maxIndex / cols) === prevRow;

    if (isIndexOutOfListBounds(list, nextIndex)) {
      if (loopFocus && lastRow) {
        nextIndex =
          event.key === (rtl ? ARROW_RIGHT : ARROW_LEFT)
            ? maxIndex
            : findNonDisabledListIndex(list, {
                startingIndex: prevIndex - (prevIndex % cols) - 1,
                disabledIndices,
              });
        if (onLoop) {
          nextIndex = onLoop(event, prevIndex, nextIndex);
        }
      } else {
        nextIndex = prevIndex;
      }
    }
  }

  return nextIndex;
}

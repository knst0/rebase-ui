import { isHTMLElement } from "@floating-ui/utils/dom";
import { createEffect, untrack } from "solid-js";

import {
  findNonDisabledListIndex,
  getMaxListIndex,
  getMinListIndex,
  isIndexOutOfListBounds,
  type DisabledIndices,
} from "../../composite/composite";
import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import { useFloatingParentNodeId, useFloatingTree } from "../tree/FloatingTree";
import type { FloatingContext } from "../types";
import { ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, ARROW_UP } from "../utils/constants";
import { activeElement, contains, getFloatingFocusElement, getTarget, isTypeableCombobox } from "../utils/element";
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from "../utils/event";

export const ESCAPE = "Escape";

export type ListNavigationOrientation = "vertical" | "horizontal" | "both";

export type ListGridNavigator = (
  event: KeyboardEvent,
  prevIndex: number,
  listRef: { current: Array<HTMLElement | null> },
  orientation: "horizontal" | "vertical" | "both",
  loopFocus: boolean,
  rtl: boolean,
  disabledIndices: DisabledIndices | undefined,
  minIndex: number,
  maxIndex: number,
  cols?: number,
) => number | undefined;

// WebKit fires zero-delta mousemove events when the list scrolls beneath a
// stationary pointer, moving the highlight during keyboard navigation.
function isWebKit(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent ?? "";
  return /applewebkit/i.test(ua) && !/chrome/i.test(ua);
}

function doSwitch(orientation: ListNavigationOrientation, vertical: boolean, horizontal: boolean): boolean {
  switch (orientation) {
    case "vertical":
      return vertical;
    case "horizontal":
      return horizontal;
    default:
      return vertical || horizontal;
  }
}

function isMainOrientationKey(key: string, orientation: ListNavigationOrientation): boolean {
  return doSwitch(orientation, key === ARROW_UP || key === ARROW_DOWN, key === ARROW_LEFT || key === ARROW_RIGHT);
}

function isMainOrientationToEndKey(key: string, orientation: ListNavigationOrientation, rtl: boolean): boolean {
  const vertical = key === ARROW_DOWN;
  const horizontal = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  return doSwitch(orientation, vertical, horizontal) || key === "Enter" || key === " " || key === "";
}

function isCrossOrientationOpenKey(key: string, orientation: ListNavigationOrientation, rtl: boolean): boolean {
  const vertical = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  const horizontal = key === ARROW_DOWN;
  return doSwitch(orientation, vertical, horizontal);
}

function isCrossOrientationCloseKey(key: string, orientation: ListNavigationOrientation, rtl: boolean, grid: boolean): boolean {
  const vertical = rtl ? key === ARROW_RIGHT : key === ARROW_LEFT;
  const horizontal = key === ARROW_UP;
  if (orientation === "both" || (orientation === "horizontal" && grid)) {
    return key === ESCAPE;
  }
  return doSwitch(orientation, vertical, horizontal);
}

export interface CreateListNavigationProps {
  /** Holds the list item elements. Static holder shared with the owner. */
  listRef: { current: Array<HTMLElement | null> };
  /** Active item index; accepts an accessor to stay reactive. @default null */
  activeIndex?: number | null | (() => number | null) | undefined;
  /** Called with the new active index when navigation moves it. */
  onNavigate?: ((activeIndex: number | null, event?: Event) => void) | undefined;
  /** Whether the interaction is enabled. Read once. @default true */
  enabled?: boolean | undefined;
  /** Selected item index, synced on open; accepts an accessor to stay reactive. @default null */
  selectedIndex?: number | null | (() => number | null) | undefined;
  /** Focus the item on open; 'auto' infers from input modality. Read once. @default 'auto' */
  focusItemOnOpen?: boolean | "auto" | undefined;
  /** Whether hovering an item syncs focus. Read once. @default true */
  focusItemOnHover?: boolean | undefined;
  /** Whether an arrow key on the main axis opens the floating element. Read once. @default true */
  openOnArrowKeyDown?: boolean | undefined;
  /** Indices to skip; overrides attribute-based disabled detection. Read once. */
  disabledIndices?: DisabledIndices | undefined;
  /** Whether navigating past the boundary escapes (needs loopFocus + virtual). Read once. @default false */
  allowEscape?: boolean | undefined;
  /** Whether navigation loops past the first/last item. Read once. @default false */
  loopFocus?: boolean | undefined;
  /** Whether the list is nested in another list. Read once. @default false */
  nested?: boolean | undefined;
  /** Parent list orientation; resolved from the tree when omitted. Read once. */
  parentOrientation?: ListNavigationOrientation | undefined;
  /** Whether navigation is in RTL layout. Read once. @default false */
  rtl?: boolean | undefined;
  /** Whether focus is virtual (aria-activedescendant). Read once. @default false */
  virtual?: boolean | undefined;
  /** Navigation orientation. Read once. @default 'vertical' */
  orientation?: ListNavigationOrientation | undefined;
  /** Root id prefix for aria-activedescendant values. Read once. */
  id?: string | undefined;
  /** Whether leaving an item with the pointer clears the active index. Read once. @default true */
  resetOnPointerLeave?: boolean | undefined;
  /** Column count forwarded to the grid navigator. Read once. @default 2 */
  cols?: number | undefined;
  /** Two-dimensional navigation (e.g. the ported `gridNavigation`). Read once. */
  grid?: ListGridNavigator | null | undefined;
}

export interface ListNavigationReferenceProps {
  "aria-activedescendant"?: string | undefined;
  onKeyDown: (event: KeyboardEvent) => void;
  onFocus: (event: FocusEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerEnter: (event: PointerEvent) => void;
  onMouseDown: (event: MouseEvent) => void;
  onClick: (event: MouseEvent) => void;
}

export interface ListNavigationFloatingProps {
  "aria-activedescendant"?: string | undefined;
  onKeyDown: (event: KeyboardEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
}

export interface ListNavigationItemProps {
  onFocus: (event: FocusEvent) => void;
  onClick: (event: MouseEvent) => void;
  onMouseMove: (event: MouseEvent) => void;
  onPointerLeave: (event: PointerEvent) => void;
}

export interface CreateListNavigationResult {
  /** Getter returning props to spread onto the Solid reference element. */
  reference: () => ListNavigationReferenceProps;
  /** Getter returning props to spread onto the Solid floating element. */
  floating: () => ListNavigationFloatingProps;
  /** Getter returning props to spread onto each Solid list item element. */
  item: () => ListNavigationItemProps;
  /** Alias of the trigger portion of `reference` (mirrors upstream). */
  trigger: () => ListNavigationReferenceProps;
}

/**
 * Adds arrow-key navigation of a list of items, using real or virtual focus.
 * Solid port of upstream `useListNavigation` (mui/base-ui v1.8.0). The owner
 * holds `activeIndex` (accessor) and mirrors `onNavigate` back into it; the
 * interaction keeps its own working index internally. Upstream manages its own
 * activeIndex/list, so this module is self-contained and only reuses the
 * list-index helpers from `internals/composite`, whose semantics match.
 * Handlers receive native DOM events; prop getters are plain arrows.
 */
export function createListNavigation(context: FloatingContext, props: CreateListNavigationProps): CreateListNavigationResult {
  const store = context.rootStore;
  const dataRef = store.context.dataRef;

  const listRef = untrack(() => props.listRef);
  const enabled = untrack(() => props.enabled ?? true);
  const allowEscape = untrack(() => props.allowEscape ?? false);
  const loopFocus = untrack(() => props.loopFocus ?? false);
  const nested = untrack(() => props.nested ?? false);
  const rtl = untrack(() => props.rtl ?? false);
  const virtual = untrack(() => props.virtual ?? false);
  const focusItemOnOpen = untrack(() => props.focusItemOnOpen ?? "auto");
  const focusItemOnHover = untrack(() => props.focusItemOnHover ?? true);
  const openOnArrowKeyDown = untrack(() => props.openOnArrowKeyDown ?? true);
  const disabledIndices = untrack(() => props.disabledIndices);
  const orientation = untrack(() => props.orientation ?? "vertical");
  const parentOrientation = untrack(() => props.parentOrientation);
  const id = untrack(() => props.id);
  const resetOnPointerLeave = untrack(() => props.resetOnPointerLeave ?? true);
  const cols = untrack(() => props.cols ?? 2);
  const navigateGrid = untrack(() => props.grid ?? null);
  const isGrid = navigateGrid != null;

  function readActiveIndex(): number | null {
    const value = props.activeIndex;
    return (typeof value === "function" ? (value as () => number | null)() : value) ?? null;
  }

  /**
   * Reactive when the owner passes an accessor: the open-sync effect tracks it, while event
   * handlers read the latest value untracked (upstream's `selectedIndexRef`).
   */
  function readSelectedIndex(): number | null {
    const value = props.selectedIndex;
    return (typeof value === "function" ? (value as () => number | null)() : value) ?? null;
  }

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();

  let indexRef = untrack(readSelectedIndex) ?? -1;
  let keyRef: string | null = null;
  let isPointerModality = true;
  let focusItemOnOpenRef: boolean | "auto" = focusItemOnOpen;
  let previousMounted = store.peek("floatingElement") != null;
  let previousOpen = store.peek("open");
  let forceSyncFocus = false;
  let forceScrollIntoView = false;
  let frameId: number | undefined;

  function onNavigateLocal(event?: Event) {
    props.onNavigate?.(indexRef === -1 ? null : indexRef, event);
  }

  function cancelQueuedFocus() {
    if (frameId !== undefined) {
      cancelAnimationFrame(frameId);
      frameId = undefined;
    }
  }

  // Clear pending focus work when the interaction owner disposes.
  createEffect(
    () => undefined,
    () => () => {
      cancelQueuedFocus();
    },
  );

  function focusItem() {
    function runFocus(item: HTMLElement) {
      if (virtual) {
        tree?.events.emit("virtualfocus", item);
      } else {
        item.focus({ preventScroll: true });
      }
    }

    const initialItem = listRef.current[indexRef];
    const forceScroll = forceScrollIntoView;

    if (initialItem) {
      runFocus(initialItem);
    }

    const scheduler = forceSyncFocus
      ? (callback: () => void) => callback()
      : (callback: () => void) => {
          if (typeof requestAnimationFrame === "function") {
            frameId = requestAnimationFrame(callback);
          } else {
            callback();
          }
        };

    scheduler(() => {
      const waitedItem = listRef.current[indexRef] || initialItem;
      if (!waitedItem) {
        return;
      }
      if (!initialItem) {
        runFocus(waitedItem);
      }
      if (forceScroll || !isPointerModality) {
        waitedItem.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }
    });
  }

  dataRef.current.orientation = orientation;

  // Sync `selectedIndex` on open; reset the index on close/unmount.
  createEffect(
    () => ({ open: store.select("open"), floating: store.select("floatingElement"), selected: readSelectedIndex() }),
    ({ open, floating, selected }) => {
      if (!enabled) {
        return;
      }
      if (open && floating) {
        indexRef = selected ?? -1;
        if (focusItemOnOpenRef && selected != null) {
          forceScrollIntoView = true;
          onNavigateLocal();
        }
      } else if (previousMounted) {
        indexRef = -1;
        onNavigateLocal();
      }
    },
  );

  // Sync `activeIndex` to the focused item while open; initially focus the
  // first/last non-disabled item once the list populates.
  createEffect(
    () => ({
      open: store.select("open"),
      floating: store.select("floatingElement"),
      active: readActiveIndex(),
    }),
    ({ open, floating, active }) => {
      if (!enabled) {
        return;
      }
      if (!open) {
        forceSyncFocus = false;
        return;
      }
      if (!floating) {
        return;
      }

      if (active == null) {
        forceSyncFocus = false;
        if (untrack(readSelectedIndex) != null) {
          return;
        }
        if (previousMounted) {
          indexRef = -1;
          focusItem();
        }
        if ((!previousOpen || !previousMounted) && focusItemOnOpenRef && (keyRef != null || focusItemOnOpenRef === true)) {
          let runs = 0;
          const waitForListPopulated = () => {
            // `disabledIndices` is deliberately omitted so attribute-disabled
            // items are skipped on open even for an empty array.
            const candidate =
              listRef.current[0] == null
                ? null
                : keyRef == null || isMainOrientationToEndKey(keyRef, orientation, rtl) || nested
                  ? getMinListIndex(listRef.current)
                  : getMaxListIndex(listRef.current);
            if (candidate == null || isIndexOutOfListBounds(listRef.current, candidate)) {
              // Empty list — or everything currently skipped. Hidden-behind-mount items read
              // as disabled, so retry instead of committing an out-of-bounds index.
              if (runs < 2) {
                const scheduler = runs ? (callback: () => void) => waitForListPopulatedFrame(callback) : queueMicrotask;
                scheduler(waitForListPopulated);
              }
              runs += 1;
            } else {
              indexRef = candidate;
              keyRef = null;
              onNavigateLocal();
            }
          };
          waitForListPopulated();
        }
      } else if (!isIndexOutOfListBounds(listRef.current, active)) {
        indexRef = active;
        focusItem();
        forceScrollIntoView = false;
      }
    },
  );

  function waitForListPopulatedFrame(callback: () => void) {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(callback);
    } else {
      callback();
    }
  }

  // Focus the parent floating element when a nested child closes so arrow
  // keys keep working after the pointer leaves the child.
  createEffect(
    () => ({ floating: store.select("floatingElement"), domReference: store.select("domReferenceElement") }),
    ({ floating, domReference }) => {
      if (!enabled || floating || !tree || virtual || !previousMounted) {
        return;
      }
      const nodes = tree.nodesRef.current;
      const parent = nodes.find((node) => node.id === parentId)?.context?.elements.floating;
      const activeEl = activeElement((domReference ?? parent ?? null)?.ownerDocument ?? document);
      const treeContainsActiveEl = nodes.some((node) => node.context && contains(node.context.elements.floating, activeEl));
      if (parent && !treeContainsActiveEl && isPointerModality) {
        parent.focus({ preventScroll: true });
      }
    },
  );

  createEffect(
    () => ({ open: store.select("open"), floating: store.select("floatingElement") }),
    ({ open, floating }) => {
      previousOpen = open;
      previousMounted = !!floating;
    },
  );

  createEffect(
    () => store.select("open"),
    (open) => {
      if (!open) {
        keyRef = null;
        focusItemOnOpenRef = focusItemOnOpen;
      }
    },
  );

  function getParentOrientation(): ListNavigationOrientation | undefined {
    return (
      parentOrientation ??
      (tree?.nodesRef.current.find((node) => node.id === parentId)?.context?.dataRef?.current.orientation as
        | ListNavigationOrientation
        | undefined)
    );
  }

  function syncCurrentTarget(event: Event) {
    if (!store.peek("open")) {
      return;
    }
    const index = listRef.current.indexOf(event.currentTarget as HTMLElement);
    if (index !== -1 && (indexRef !== index || untrack(readActiveIndex) !== index)) {
      indexRef = index;
      onNavigateLocal(event);
    }
  }

  function commonOnKeyDown(event: KeyboardEvent) {
    isPointerModality = false;
    forceSyncFocus = true;

    // Ignore IME composition keys (Chrome fires ArrowDown twice otherwise).
    if (event.which === 229) {
      return;
    }

    // Ignore navigation while the floating element is animating out.
    const floatingFocusElement = getFloatingFocusElement(store.peek("floatingElement"));
    if (!store.peek("open") && event.currentTarget === floatingFocusElement) {
      return;
    }

    const domReferenceElement = store.peek("domReferenceElement");

    if (nested && isCrossOrientationCloseKey(event.key, orientation, rtl, isGrid)) {
      // Let the parent navigate when the close key is also its nav key.
      if (!isMainOrientationKey(event.key, getParentOrientation() ?? orientation)) {
        stopEvent(event);
      }
      store.setOpen(false, createChangeEventDetails(REASONS.listNavigation, event));
      if (isHTMLElement(domReferenceElement)) {
        if (virtual) {
          tree?.events.emit("virtualfocus", domReferenceElement);
        } else {
          domReferenceElement.focus();
        }
      }
      return;
    }

    const currentIndex = indexRef;
    const minIndex = getMinListIndex(listRef.current, disabledIndices);
    const maxIndex = getMaxListIndex(listRef.current, disabledIndices);
    const typeableComboboxReference = isTypeableCombobox(domReferenceElement);

    if (!typeableComboboxReference) {
      if (event.key === "Home") {
        stopEvent(event);
        indexRef = minIndex;
        onNavigateLocal(event);
      }
      if (event.key === "End") {
        stopEvent(event);
        indexRef = maxIndex;
        onNavigateLocal(event);
      }
    }

    // Grid navigation is injected by grid-capable consumers so the rest
    // tree-shake the grid helpers out.
    if (navigateGrid != null) {
      const index = navigateGrid(event, indexRef, listRef, orientation, loopFocus, rtl, disabledIndices, minIndex, maxIndex, cols);
      if (index != null) {
        indexRef = index;
        onNavigateLocal(event);
      }
      if (orientation === "both") {
        return;
      }
    }

    if (isMainOrientationKey(event.key, orientation)) {
      stopEvent(event);

      // Reset the index if no item is focused.
      if (store.peek("open") && !virtual && activeElement((event.currentTarget as Element).ownerDocument) === event.currentTarget) {
        indexRef = isMainOrientationToEndKey(event.key, orientation, rtl) ? minIndex : maxIndex;
        onNavigateLocal(event);
        return;
      }

      if (isMainOrientationToEndKey(event.key, orientation, rtl)) {
        if (loopFocus) {
          if (currentIndex >= maxIndex) {
            if (allowEscape && currentIndex !== listRef.current.length) {
              indexRef = -1;
            } else {
              // Give virtualizers time to update the list.
              forceSyncFocus = false;
              indexRef = minIndex;
            }
          } else {
            indexRef = findNonDisabledListIndex(listRef.current, { startingIndex: currentIndex, disabledIndices });
          }
        } else {
          indexRef = Math.min(maxIndex, findNonDisabledListIndex(listRef.current, { startingIndex: currentIndex, disabledIndices }));
        }
      } else if (loopFocus) {
        if (currentIndex <= minIndex) {
          if (allowEscape && currentIndex !== -1) {
            indexRef = listRef.current.length;
          } else {
            // Give virtualizers time to update the list.
            forceSyncFocus = false;
            indexRef = maxIndex;
          }
        } else {
          indexRef = findNonDisabledListIndex(listRef.current, {
            startingIndex: currentIndex,
            decrement: true,
            disabledIndices,
          });
        }
      } else {
        indexRef = Math.max(
          minIndex,
          findNonDisabledListIndex(listRef.current, {
            startingIndex: currentIndex,
            decrement: true,
            disabledIndices,
          }),
        );
      }

      if (isIndexOutOfListBounds(listRef.current, indexRef)) {
        indexRef = -1;
      }

      onNavigateLocal(event);
    }
  }

  function activeDescendantId(): string | undefined {
    const active = readActiveIndex();
    if (virtual && store.select("open") && active != null) {
      return `${id}-${active}`;
    }
    return undefined;
  }

  const itemProps: ListNavigationItemProps = {
    onFocus(event) {
      forceSyncFocus = true;
      syncCurrentTarget(event);
    },
    // Safari needs an explicit focus on click.
    onClick(event) {
      (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    },
    onMouseMove(event) {
      if (isWebKit() && event.movementX === 0 && event.movementY === 0) {
        return;
      }
      isPointerModality = true;
      forceSyncFocus = true;
      forceScrollIntoView = false;
      if (focusItemOnHover) {
        syncCurrentTarget(event);
      }
    },
    onPointerLeave(event) {
      if (!store.peek("open") || !isPointerModality || event.pointerType === "touch") {
        return;
      }
      forceSyncFocus = true;
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      if (!focusItemOnHover || (relatedTarget && listRef.current.includes(relatedTarget))) {
        return;
      }
      if (!resetOnPointerLeave) {
        return;
      }
      cancelQueuedFocus();
      indexRef = -1;
      onNavigateLocal(event);
      if (!virtual) {
        const floatingFocusElement = getFloatingFocusElement(store.peek("floatingElement"));
        const activeEl = floatingFocusElement ? activeElement(floatingFocusElement.ownerDocument) : null;
        if (floatingFocusElement && activeEl && contains(floatingFocusElement, activeEl as Element)) {
          floatingFocusElement.focus({ preventScroll: true });
        }
      }
    },
  };

  // Aria props are composed inside the getters (not here) so virtual
  // `aria-activedescendant` reflects the current open/active state.
  function ariaSpread(): { "aria-activedescendant"?: string | undefined } {
    const value = activeDescendantId();
    return value == null ? {} : { "aria-activedescendant": value };
  }

  const floatingHandlers = {
    onKeyDown(event: KeyboardEvent) {
      // Close submenus on Shift+Tab unless focus moved into nested content.
      if (event.key === "Tab" && event.shiftKey && store.peek("open") && !virtual) {
        const target = getTarget(event) as Element | null;
        if (target && !contains(getFloatingFocusElement(store.peek("floatingElement")), target)) {
          return;
        }
        stopEvent(event);
        store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));
        const domReferenceElement = store.peek("domReferenceElement");
        if (isHTMLElement(domReferenceElement)) {
          domReferenceElement.focus();
        }
        return;
      }
      commonOnKeyDown(event);
    },
    onPointerMove(event: PointerEvent) {
      if (isWebKit() && event.movementX === 0 && event.movementY === 0) {
        return;
      }
      isPointerModality = true;
    },
  };

  const triggerHandlers = {
    onKeyDown(event: KeyboardEvent) {
      const currentOpen = store.peek("open");
      isPointerModality = false;

      const isArrowKey = event.key.startsWith("Arrow");
      const isParentCrossOpenKey = isCrossOrientationOpenKey(event.key, getParentOrientation() ?? orientation, rtl);
      const isMainKey = isMainOrientationKey(event.key, orientation);
      const isNavigationKey = (nested ? isParentCrossOpenKey : isMainKey) || event.key === "Enter" || event.key.trim() === "";

      if (virtual && currentOpen) {
        commonOnKeyDown(event);
        return;
      }

      // Avoid setting `activeIndex` while closed when arrow keys shouldn't open.
      if (!currentOpen && !openOnArrowKeyDown && isArrowKey) {
        return;
      }

      if (isNavigationKey) {
        const isParentMainKey = isMainOrientationKey(event.key, getParentOrientation() ?? orientation);
        keyRef = nested && isParentMainKey ? null : event.key;
      }

      if (nested) {
        if (isParentCrossOpenKey) {
          stopEvent(event);
          if (currentOpen) {
            indexRef = getMinListIndex(listRef.current, disabledIndices);
            onNavigateLocal(event);
          } else {
            store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event, event.currentTarget as HTMLElement));
          }
        }
        return;
      }

      if (isMainKey) {
        const selected = untrack(readSelectedIndex);
        if (selected != null) {
          indexRef = selected;
        }
        stopEvent(event);
        if (!currentOpen && openOnArrowKeyDown) {
          store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event, event.currentTarget as HTMLElement));
        } else {
          commonOnKeyDown(event);
        }
        if (currentOpen) {
          onNavigateLocal(event);
        }
      }
    },
    onFocus(event: FocusEvent) {
      if (store.peek("open") && !virtual) {
        indexRef = -1;
        onNavigateLocal(event);
      }
    },
    onPointerDown(event: PointerEvent) {
      focusItemOnOpenRef = focusItemOnOpen;
      if (focusItemOnOpen === "auto" && isVirtualPointerEvent(event)) {
        focusItemOnOpenRef = true;
      }
    },
    onPointerEnter(event: PointerEvent) {
      focusItemOnOpenRef = focusItemOnOpen;
      if (focusItemOnOpen === "auto" && isVirtualPointerEvent(event)) {
        focusItemOnOpenRef = true;
      }
    },
    onMouseDown(event: MouseEvent) {
      if (focusItemOnOpen === "auto" && isVirtualClick(event)) {
        focusItemOnOpenRef = !virtual;
      }
    },
    onClick(event: MouseEvent) {
      if (focusItemOnOpen === "auto" && isVirtualClick(event)) {
        focusItemOnOpenRef = !virtual;
      }
    },
  };

  const item = () => (enabled ? itemProps : ({} as ListNavigationItemProps));
  const floating = (): ListNavigationFloatingProps =>
    enabled ? { ...ariaSpread(), ...floatingHandlers } : ({} as ListNavigationFloatingProps);
  const trigger = (): ListNavigationReferenceProps =>
    enabled ? { ...ariaSpread(), ...triggerHandlers } : ({} as ListNavigationReferenceProps);
  const reference = (): ListNavigationReferenceProps =>
    enabled ? { ...ariaSpread(), ...triggerHandlers } : ({} as ListNavigationReferenceProps);

  return { reference, floating, item, trigger };
}

export const ARROW_UP = "ArrowUp";
export const ARROW_DOWN = "ArrowDown";
export const ARROW_LEFT = "ArrowLeft";
export const ARROW_RIGHT = "ArrowRight";
export const HOME = "Home";
export const END = "End";
export const PAGE_UP = "PageUp";
export const PAGE_DOWN = "PageDown";

export const COMPOSITE_KEYS = new Set<string>([ARROW_UP, ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, HOME, END]);

export const SHIFT = "Shift" as const;
export const MODIFIER_KEYS = [SHIFT, "Control", "Alt", "Meta"] as const;

export type ModifierKey = (typeof MODIFIER_KEYS)[number];

export type CompositeOrientation = "horizontal" | "vertical" | "both";

export type TextDirection = "ltr" | "rtl";

export type DisabledIndices = readonly number[] | ((index: number) => boolean);

export type CompositeElements = ReadonlyArray<HTMLElement | null>;

export function stopEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

export function isModifierKeySet(event: KeyboardEvent, ignoredModifierKeys: readonly ModifierKey[]): boolean {
  for (const key of MODIFIER_KEYS) {
    if (ignoredModifierKeys.includes(key)) {
      continue;
    }
    if (event.getModifierState(key)) {
      return true;
    }
  }

  return false;
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}

function isInputElement(element: EventTarget): element is HTMLInputElement {
  return isHTMLElement(element) && element.tagName === "INPUT";
}

export function isNativeInput(element: EventTarget): element is HTMLElement & (HTMLInputElement | HTMLTextAreaElement) {
  if (isInputElement(element) && element.selectionStart != null) {
    return true;
  }
  return isHTMLElement(element) && element.tagName === "TEXTAREA";
}

export function isHiddenByStyles(styles: CSSStyleDeclaration): boolean {
  return styles.visibility === "hidden" || styles.visibility === "collapse";
}

export function isElementVisible(element: Element | null): boolean {
  if (!element || !element.isConnected) {
    return false;
  }

  const styles = getComputedStyle(element);
  if (isHiddenByStyles(styles)) {
    return false;
  }

  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility();
  }

  return styles.display !== "none" && styles.display !== "contents";
}

export function isElementDisabled(element: Element | null | undefined): boolean {
  if (!element) {
    return true;
  }
  return element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
}

export function isListIndexDisabled(list: CompositeElements, index: number, disabledIndices?: DisabledIndices): boolean {
  const isExplicitlyDisabled = typeof disabledIndices === "function" ? disabledIndices(index) : (disabledIndices?.includes(index) ?? false);

  if (isExplicitlyDisabled) {
    return true;
  }

  const element = list[index];
  if (!element) {
    return false;
  }

  if (!isElementVisible(element)) {
    return true;
  }

  // A natively disabled element can never receive focus, so it must always be
  // skipped, even when `disabledIndices` marks it as enabled. Only `aria-disabled`
  // items can be focusable-while-disabled.
  if (element.matches(":disabled")) {
    return true;
  }

  return !disabledIndices && (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true");
}

export function isIndexOutOfListBounds(list: CompositeElements, index: number): boolean {
  return index < 0 || index >= list.length;
}

export interface FindNonDisabledListIndexOptions {
  startingIndex?: number | undefined;
  decrement?: boolean | undefined;
  disabledIndices?: DisabledIndices | undefined;
  amount?: number | undefined;
}

export function findNonDisabledListIndex(list: CompositeElements, options: FindNonDisabledListIndexOptions = {}): number {
  const { startingIndex = -1, decrement = false, disabledIndices, amount = 1 } = options;

  let index = startingIndex;

  do {
    index += decrement ? -amount : amount;
  } while (index >= 0 && index <= list.length - 1 && isListIndexDisabled(list, index, disabledIndices));

  return index;
}

export function getMinListIndex(list: CompositeElements, disabledIndices?: DisabledIndices): number {
  return findNonDisabledListIndex(list, { disabledIndices });
}

export function getMaxListIndex(list: CompositeElements, disabledIndices?: DisabledIndices): number {
  return findNonDisabledListIndex(list, { decrement: true, startingIndex: list.length, disabledIndices });
}

export function sortByDocumentPosition(elements: HTMLElement[], element: HTMLElement): HTMLElement[] {
  const next = elements.slice();
  const index = next.findIndex((current) => {
    const position = current.compareDocumentPosition(element);

    if (position & Node.DOCUMENT_POSITION_DISCONNECTED) {
      return false;
    }

    return (position & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
  });

  if (index === -1) {
    next.push(element);
  } else {
    next.splice(index, 0, element);
  }

  return next;
}

export function scrollIntoViewIfNeeded(
  scrollContainer: HTMLElement | null,
  element: HTMLElement | null,
  direction: TextDirection,
  orientation: CompositeOrientation,
) {
  if (!scrollContainer || !element || !element.scrollTo) {
    return;
  }

  let targetX = scrollContainer.scrollLeft;
  let targetY = scrollContainer.scrollTop;

  const isOverflowingX = scrollContainer.clientWidth < scrollContainer.scrollWidth;
  const isOverflowingY = scrollContainer.clientHeight < scrollContainer.scrollHeight;

  if (isOverflowingX && orientation !== "vertical") {
    const elementOffsetLeft = getOffset(scrollContainer, element, "left");
    const containerStyles = getScrollStyles(scrollContainer);
    const elementStyles = getScrollStyles(element);

    const overflowsRight =
      elementOffsetLeft + element.offsetWidth + elementStyles.scrollMarginRight >
      scrollContainer.scrollLeft + scrollContainer.clientWidth - containerStyles.scrollPaddingRight;
    const overflowsLeft =
      elementOffsetLeft - elementStyles.scrollMarginLeft < scrollContainer.scrollLeft + containerStyles.scrollPaddingLeft;

    const alignRight = () => {
      targetX =
        elementOffsetLeft +
        element.offsetWidth +
        elementStyles.scrollMarginRight -
        scrollContainer.clientWidth +
        containerStyles.scrollPaddingRight;
    };
    const alignLeft = () => {
      targetX = elementOffsetLeft - elementStyles.scrollMarginLeft - containerStyles.scrollPaddingLeft;
    };

    if (direction === "ltr") {
      if (overflowsRight) {
        alignRight();
      } else if (overflowsLeft) {
        alignLeft();
      }
    } else if (overflowsLeft) {
      alignLeft();
    } else if (overflowsRight) {
      alignRight();
    }
  }

  if (isOverflowingY && orientation !== "horizontal") {
    const elementOffsetTop = getOffset(scrollContainer, element, "top");
    const containerStyles = getScrollStyles(scrollContainer);
    const elementStyles = getScrollStyles(element);

    if (elementOffsetTop - elementStyles.scrollMarginTop < scrollContainer.scrollTop + containerStyles.scrollPaddingTop) {
      targetY = elementOffsetTop - elementStyles.scrollMarginTop - containerStyles.scrollPaddingTop;
    } else if (
      elementOffsetTop + element.offsetHeight + elementStyles.scrollMarginBottom >
      scrollContainer.scrollTop + scrollContainer.clientHeight - containerStyles.scrollPaddingBottom
    ) {
      targetY =
        elementOffsetTop +
        element.offsetHeight +
        elementStyles.scrollMarginBottom -
        scrollContainer.clientHeight +
        containerStyles.scrollPaddingBottom;
    }
  }

  scrollContainer.scrollTo({ left: targetX, top: targetY, behavior: "auto" });
}

function getOffset(ancestor: HTMLElement, element: HTMLElement, side: "left" | "top"): number {
  const propName = side === "left" ? "offsetLeft" : "offsetTop";

  let result = 0;
  let current = element;

  while (current.offsetParent) {
    result += current[propName];
    if (current.offsetParent === ancestor) {
      break;
    }
    current = current.offsetParent as HTMLElement;
  }

  return result;
}

function getScrollStyles(element: HTMLElement) {
  const styles = getComputedStyle(element);
  return {
    scrollMarginTop: parseFloat(styles.scrollMarginTop) || 0,
    scrollMarginRight: parseFloat(styles.scrollMarginRight) || 0,
    scrollMarginBottom: parseFloat(styles.scrollMarginBottom) || 0,
    scrollMarginLeft: parseFloat(styles.scrollMarginLeft) || 0,
    scrollPaddingTop: parseFloat(styles.scrollPaddingTop) || 0,
    scrollPaddingRight: parseFloat(styles.scrollPaddingRight) || 0,
    scrollPaddingBottom: parseFloat(styles.scrollPaddingBottom) || 0,
    scrollPaddingLeft: parseFloat(styles.scrollPaddingLeft) || 0,
  };
}

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

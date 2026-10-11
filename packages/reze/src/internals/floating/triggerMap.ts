import type { TriggerElementsMap } from "./types";

/**
 * Development-only reverse index of element to registered id, keyed by the owning map.
 */
let devElementIdsByMap: WeakMap<PopupTriggerMap, WeakMap<Element, string>> | undefined;

function getDevElementIds(map: PopupTriggerMap) {
  devElementIdsByMap ??= new WeakMap();

  let elementIds = devElementIdsByMap.get(map);
  if (!elementIds) {
    elementIds = new WeakMap();
    devElementIdsByMap.set(map, elementIds);
  }
  return elementIds;
}

/**
 * Keeps track of trigger elements by their IDs.
 * Ported from Base UI `utils/popups/popupTriggerMap.ts`; satisfies the floating
 * `TriggerElementsMap` structural contract until the popup group is ported.
 */
export class PopupTriggerMap implements TriggerElementsMap {
  private idMap: Map<string, Element>;

  constructor() {
    this.idMap = new Map();
  }

  /**
   * Adds a trigger element with the given ID.
   *
   * Note: The provided element is assumed to not be registered under multiple IDs.
   */
  public add(id: string, element: Element) {
    if (process.env.NODE_ENV !== "production") {
      const elementIds = getDevElementIds(this);

      const existingId = elementIds.get(element);
      if (existingId !== undefined && existingId !== id) {
        throw new Error("Base UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.");
      }

      // Reusing an id for a different element evicts the previous one, so it must lose its claim
      // on the id or a later registration under a different id would be reported as a duplicate.
      const previousElement = this.idMap.get(id);
      if (previousElement !== undefined && previousElement !== element) {
        elementIds.delete(previousElement);
      }

      elementIds.set(element, id);
    }

    this.idMap.set(id, element);
  }

  /**
   * Removes the trigger element with the given ID.
   */
  public delete(id: string) {
    if (process.env.NODE_ENV !== "production") {
      const element = this.idMap.get(id);
      if (element !== undefined) {
        devElementIdsByMap?.get(this)?.delete(element);
      }
    }

    this.idMap.delete(id);
  }

  /**
   * Whether the given element is registered as a trigger.
   */
  public hasElement(element: Element): boolean {
    for (const registered of this.idMap.values()) {
      if (registered === element) {
        return true;
      }
    }

    return false;
  }

  /**
   * Whether there is a registered trigger element matching the given predicate.
   */
  public hasMatchingElement(predicate: (el: Element) => boolean): boolean {
    for (const element of this.idMap.values()) {
      if (predicate(element)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Returns the trigger element associated with the given ID, or undefined if no such element exists.
   */
  public getById(id: string): Element | undefined {
    return this.idMap.get(id);
  }

  /**
   * Returns an iterable of all registered trigger entries, where each entry is a tuple of [id, element].
   */
  public entries(): IterableIterator<[string, Element]> {
    return this.idMap.entries();
  }

  /**
   * Returns an iterable of all registered trigger elements.
   */
  public elements(): IterableIterator<Element> {
    return this.idMap.values();
  }

  /**
   * Returns the number of registered trigger elements.
   */
  public get size(): number {
    return this.idMap.size;
  }
}

import { store, untrack } from "reze-js";

import { orderByDocumentPosition } from "./documentOrder";

export type ElementMetadata<Metadata> = Metadata | (() => Metadata | undefined) | undefined;

export interface ElementRegistry<Metadata> {
  register: (element: HTMLElement, metadata?: ElementMetadata<Metadata>) => void;
  unregister: (element: HTMLElement) => void;
  /**
   * Re-sorts the registered elements. Call once the owner mounts: refs can register elements
   * while they are still detached (or in separate fragments), and a sort computed then caches
   * the disconnected order until the next registration.
   */
  refresh: () => void;
  /** Registered elements in document order. Recomputed once per batch, not per registration. */
  elements: () => HTMLElement[];
  /** Document-order position of an element, or `-1`. Reactive, but O(1) per read. */
  indexOf: (element: HTMLElement | null) => number;
  /** Resolves the metadata stored for an element. Tracks accessor metadata. */
  metadataOf: (element: HTMLElement) => Metadata | undefined;
}

export function createElementRegistry<Metadata>(): ElementRegistry<Metadata> {
  const entries = new Map<HTMLElement, ElementMetadata<Metadata>>();
  const state = store({ version: 0 });

  // The sorted list and its index map are cached per version: every reader in the
  // same batch shares one sort, and the array identity stays stable between writes.
  let cachedVersion = -1;
  let cachedElements: HTMLElement[] = [];
  let cachedIndices = new WeakMap<HTMLElement, number>();

  function bumpVersion(): void {
    // Actions never subscribe: without untrack, the read half of += inside an
    // effect would subscribe the effect to the version it writes (self-loop).
    untrack(() => {
      state.version += 1;
    });
  }

  function register(element: HTMLElement, metadata?: ElementMetadata<Metadata>): void {
    entries.set(element, metadata);
    bumpVersion();
  }

  function unregister(element: HTMLElement): void {
    if (!entries.delete(element)) {
      return;
    }
    bumpVersion();
  }

  function refresh(): void {
    bumpVersion();
  }

  function elements(): HTMLElement[] {
    // The version read subscribes the caller in a tracking scope; one-shot readers
    // (event handlers) just get the current value while sharing the same cache.
    const version = state.version;
    if (cachedVersion !== version) {
      cachedVersion = version;
      cachedElements = orderByDocumentPosition(entries.keys());
      const next = new WeakMap<HTMLElement, number>();
      for (let index = 0; index < cachedElements.length; index += 1) {
        next.set(cachedElements[index], index);
      }
      cachedIndices = next;
    }
    return cachedElements;
  }

  function indexOf(element: HTMLElement | null): number {
    // Read unconditionally so index queries subscribe to registry changes even
    // when there is nothing to look up yet (e.g. before the item's ref runs).
    // Otherwise the first `-1` would stick forever: later registrations could
    // never invalidate the reader.
    elements();
    if (element === null) {
      return -1;
    }
    return cachedIndices.get(element) ?? -1;
  }

  function metadataOf(element: HTMLElement): Metadata | undefined {
    const metadata = entries.get(element);
    return typeof metadata === "function" ? (metadata as () => Metadata | undefined)() : metadata;
  }

  return { register, unregister, refresh, elements, indexOf, metadataOf };
}

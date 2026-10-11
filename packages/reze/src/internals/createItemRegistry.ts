import { store, untrack } from "reze-js";

export type RegisterItem<Key, Item> = (key: Key, item: Item) => () => void;

/**
 * Collects item registrations into one immutable snapshot per update.
 * Also exposes the live registry for reads that must include registrations
 * made before the next snapshot is published.
 */
export function createItemRegistry<Key, Item>(): ItemRegistry<Key, Item> {
  const liveItems = new Map<Key, Item>();
  const state = store({ version: 0 });

  // The snapshot is cached per version: every reader in the same batch shares
  // one copy, and the map identity stays stable between writes.
  let cachedVersion = -1;
  let cachedItems: ReadonlyMap<Key, Item> = new Map();

  const registerItem: RegisterItem<Key, Item> = (key, item) => {
    liveItems.set(key, item);
    // Bump outside tracking so registration from an effect or ref callback
    // stays a plain write.
    untrack(() => {
      state.version += 1;
    });

    return () => {
      liveItems.delete(key);
      untrack(() => {
        state.version += 1;
      });
    };
  };

  function items(): ReadonlyMap<Key, Item> {
    // The version read subscribes the caller in a tracking scope; one-shot readers
    // (event handlers) just get the current value while sharing the same cache.
    const version = state.version;
    if (cachedVersion !== version) {
      cachedVersion = version;
      cachedItems = new Map(liveItems);
    }
    return cachedItems;
  }

  return { items, registerItem, liveItems };
}

export interface ItemRegistry<Key, Item> {
  /** The snapshot published after the latest registrations. */
  items: () => ReadonlyMap<Key, Item>;
  registerItem: RegisterItem<Key, Item>;
  /** The registry itself, including registrations whose snapshot hasn't been published yet. */
  liveItems: ReadonlyMap<Key, Item>;
}

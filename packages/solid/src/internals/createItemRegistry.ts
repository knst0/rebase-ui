import { type Accessor, createMemo, createSignal, untrack } from "solid-js";

export type RegisterItem<Key, Item> = (key: Key, item: Item) => () => void;

/**
 * Collects item registrations into one immutable snapshot per update.
 * Also exposes the live registry for reads that must include registrations
 * made before the next snapshot is published.
 */
export function createItemRegistry<Key, Item>(): ItemRegistry<Key, Item> {
  const liveItems = new Map<Key, Item>();
  // Written from registering children's setup, so owned writes are intentional.
  const [version, setVersion] = createSignal(0, { ownedWrite: true });

  const registerItem: RegisterItem<Key, Item> = (key, item) => {
    liveItems.set(key, item);
    // Bump outside tracking so registration from an effect apply or ref
    // callback stays a plain write.
    untrack(() => setVersion((prev) => prev + 1));

    return () => {
      liveItems.delete(key);
      untrack(() => setVersion((prev) => prev + 1));
    };
  };

  const items = createMemo(() => {
    version();
    return new Map(liveItems);
  });

  return { items, registerItem, liveItems };
}

export interface ItemRegistry<Key, Item> {
  /** The snapshot published after the latest registrations. */
  items: Accessor<ReadonlyMap<Key, Item>>;
  registerItem: RegisterItem<Key, Item>;
  /** The registry itself, including registrations whose snapshot hasn't been published yet. */
  liveItems: ReadonlyMap<Key, Item>;
}

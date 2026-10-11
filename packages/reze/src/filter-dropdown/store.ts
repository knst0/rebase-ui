import { store as createStore, untrack } from "reze-js";

export interface FilterDropdownState {
  visibleItemIds: ReadonlySet<symbol> | null;
  registeredItemCount: number;
}

export const filterDropdownSelectors = {
  // A null `visibleItemIds` means no query, so fall back to whether anything registered.
  isEmpty: (state: FilterDropdownState) =>
    state.visibleItemIds === null ? state.registeredItemCount === 0 : state.visibleItemIds.size === 0,
  isItemVisible: (state: FilterDropdownState, id: symbol) => state.visibleItemIds === null || state.visibleItemIds.has(id),
};

/**
 * Publishes the filter result. Uses the same synchronous-snapshot + per-key
 * version-signal pattern as `PopupStore`: the plain-object `snapshot` is the
 * single source of truth (writes must be visible to synchronous reads right
 * after writing), and one version counter per state key provides granular
 * reactivity — a reader only re-runs when a key it actually read changes.
 */
export class FilterDropdownStore {
  private snapshot: FilterDropdownState;

  private readonly keyVersions: Record<string, number>;

  constructor() {
    this.snapshot = { visibleItemIds: null, registeredItemCount: 0 };
    this.keyVersions = createStore({ visibleItemIds: 0, registeredItemCount: 0 });
  }

  private trackKey(key: string): void {
    // The read subscribes the enclosing computation in a tracking scope;
    // one-shot readers just get the current value.
    void this.keyVersions[key];
  }

  private bumpKey(key: string): void {
    // Actions never subscribe: without untrack, the read half of the increment inside an
    // effect would subscribe the effect to the version it writes (self-loop).
    untrack(() => {
      this.keyVersions[key] = (this.keyVersions[key] ?? 0) + 1;
    });
  }

  /**
   * Reads the current value for a state key. Must only be called in a tracking
   * scope (effect, JSX, derived reader); the computation subscribes only to
   * this key.
   */
  select = <Key extends keyof FilterDropdownState>(key: Key): FilterDropdownState[Key] => {
    this.trackKey(key);
    return this.snapshot[key];
  };

  /**
   * Reads the current value for a state key without subscribing. Use in event
   * handlers, timeouts, and untracked effect continuations — anywhere a
   * one-shot read must not track.
   */
  peek = <Key extends keyof FilterDropdownState>(key: Key): FilterDropdownState[Key] => {
    return this.snapshot[key];
  };

  set = <Key extends keyof FilterDropdownState>(key: Key, value: FilterDropdownState[Key]) => {
    if (Object.is(this.snapshot[key], value)) {
      return;
    }
    this.snapshot = { ...this.snapshot, [key]: value };
    this.bumpKey(key);
  };

  isEmpty = (): boolean =>
    filterDropdownSelectors.isEmpty({
      visibleItemIds: this.select("visibleItemIds"),
      registeredItemCount: this.select("registeredItemCount"),
    });

  isItemVisible = (id: symbol): boolean =>
    filterDropdownSelectors.isItemVisible(
      { visibleItemIds: this.select("visibleItemIds"), registeredItemCount: this.peek("registeredItemCount") },
      id,
    );

  peekIsItemVisible = (id: symbol): boolean =>
    filterDropdownSelectors.isItemVisible(
      { visibleItemIds: this.peek("visibleItemIds"), registeredItemCount: this.peek("registeredItemCount") },
      id,
    );
}

/**
 * Stand-in for an item whose owning dropdown is absent, such as a filterable submenu's trigger
 * inside a plain parent menu. Nothing registers and every item stays visible.
 */
export const DETACHED_OWNER: {
  registerItem: (id: symbol, registration: { getText: () => string | undefined }) => () => void;
  store: FilterDropdownStore;
} = {
  registerItem: () => () => {},
  store: new FilterDropdownStore(),
};

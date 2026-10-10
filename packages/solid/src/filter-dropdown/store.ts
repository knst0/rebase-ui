import { type Accessor, createSignal, untrack } from "solid-js";

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

export class FilterDropdownStore {
  private readonly snapshot: () => FilterDropdownState;
  private readonly setSnapshot: (next: FilterDropdownState) => void;

  constructor() {
    // Written from registering children's setup, so owned writes are intentional.
    const [snapshot, setSnapshot] = createSignal<FilterDropdownState>(
      { visibleItemIds: null, registeredItemCount: 0 },
      { ownedWrite: true },
    );
    this.snapshot = snapshot;
    this.setSnapshot = setSnapshot;
  }

  select = <Key extends keyof FilterDropdownState>(key: Key): FilterDropdownState[Key] => {
    return this.snapshot()[key];
  };

  peek = <Key extends keyof FilterDropdownState>(key: Key): FilterDropdownState[Key] => {
    return untrack(this.snapshot)[key];
  };

  set = <Key extends keyof FilterDropdownState>(key: Key, value: FilterDropdownState[Key]) => {
    const current = untrack(this.snapshot);
    if (Object.is(current[key], value)) {
      return;
    }
    this.setSnapshot({ ...current, [key]: value });
  };

  isEmpty: Accessor<boolean> = () => filterDropdownSelectors.isEmpty(this.snapshot());

  isItemVisible = (id: symbol): boolean => filterDropdownSelectors.isItemVisible(this.snapshot(), id);

  peekIsItemVisible = (id: symbol): boolean => filterDropdownSelectors.isItemVisible(untrack(this.snapshot), id);
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

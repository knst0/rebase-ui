import { compareItemEquality } from "@rebase-ui/core/itemEquality";
import { defaultItemEquality } from "@rebase-ui/core/itemEquality";
import { type Accessor, createEffect, createSignal, type Setter } from "solid-js";

import { EMPTY_OBJECT } from "#utils/empty";

import type { Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import type { FloatingRootStore } from "../../internals/floating/tree/FloatingRootStore";
import type { TransitionStatus } from "../../internals/transition-status/createTransitionStatus";
import type { SelectRoot } from "../root/SelectRoot";
import { hasNullItemLabel, stringifyAsValue } from "../utils/resolveValueLabel";
import type { SelectItemsInput } from "../utils/resolveValueLabel";

export type SelectInteractionType = "keyboard" | "mouse" | "touch" | "pen" | "";

export type SelectStoreState = {
  id: string | undefined;
  labelId: string | undefined;
  modal: boolean;
  multiple: boolean;

  items: SelectItemsInput;
  itemToStringLabel: ((item: any) => string) | undefined;
  itemToStringValue: ((item: any) => string) | undefined;
  isItemEqualToValue: (itemValue: any, selectedValue: any) => boolean;

  value: any;

  open: boolean;
  mounted: boolean;
  forceMount: boolean;
  transitionStatus: TransitionStatus;
  openMethod: SelectInteractionType | null;

  activeIndex: number | null;
  selectedIndex: number | null;

  popupProps: Record<string, unknown>;
  triggerProps: Record<string, unknown>;
  triggerElement: HTMLElement | null;
  positionerElement: HTMLElement | null;
  listElement: HTMLDivElement | null;
  popupSide: Side | null;

  scrollUpArrowVisible: boolean;
  scrollDownArrowVisible: boolean;

  hasScrollArrows: boolean;

  floatingRootContext: FloatingRootStore;
};

/**
 * Non-reactive values shared with the select parts. Nothing here is observable through
 * `selectors`, so writing to a ref never notifies subscribers.
 */
export type SelectStoreContext = {
  readonly listRef: { current: Array<HTMLElement | null> };
  readonly popupRef: { current: HTMLDivElement | null };
  readonly scrollHandlerRef: { current: ((element: HTMLDivElement) => void) | null };
  readonly scrollArrowsMountedCountRef: { current: number };
  readonly valueRef: { current: HTMLElement | null };
  readonly valuesRef: { current: Array<any> };
  readonly labelsRef: { current: Array<string | null> };
  readonly typingRef: { current: boolean };
  readonly selectionRef: {
    current: {
      allowUnselectedMouseUp: boolean;
      allowSelectedMouseUp: boolean;
      dragY: number;
    };
  };
  readonly firstItemTextRef: { current: HTMLElement | null };
  readonly selectedItemTextRef: { current: HTMLElement | null };
  readonly alignItemWithTriggerActiveRef: { current: boolean };
  readonly initialValueRef: { current: any };

  // Commands. Seeded with `NOOP` when the store is constructed and assigned during the root's
  // first render, so they are not `readonly`.
  setValue: (nextValue: any, eventDetails: SelectRoot.ChangeEventDetails) => void;
  setOpen: (open: boolean, eventDetails: SelectRoot.ChangeEventDetails) => void;
  handleScrollArrowVisibility: (scroller: HTMLElement) => void;
  onOpenChangeComplete: (open: boolean) => void;
};

export const selectors = {
  id: (state: SelectStoreState) => state.id,
  labelId: (state: SelectStoreState) => state.labelId,
  modal: (state: SelectStoreState) => state.modal,

  items: (state: SelectStoreState) => state.items,
  itemToStringLabel: (state: SelectStoreState) => state.itemToStringLabel,
  isItemEqualToValue: (state: SelectStoreState) => state.isItemEqualToValue,

  value: (state: SelectStoreState) => state.value,

  hasSelectedValue: (state: SelectStoreState) => {
    const { value, multiple, itemToStringValue } = state;
    if (value == null) {
      return false;
    }
    if (multiple && Array.isArray(value)) {
      return value.length > 0;
    }

    return stringifyAsValue(value, itemToStringValue) !== "";
  },

  hasNullItemLabel: (state: SelectStoreState, enabled: boolean) => {
    return enabled ? hasNullItemLabel(state.items) : false;
  },

  open: (state: SelectStoreState) => state.open,
  mounted: (state: SelectStoreState) => state.mounted,
  forceMount: (state: SelectStoreState) => state.forceMount,
  transitionStatus: (state: SelectStoreState) => state.transitionStatus,
  openMethod: (state: SelectStoreState) => state.openMethod,

  activeIndex: (state: SelectStoreState) => state.activeIndex,
  selectedIndex: (state: SelectStoreState) => state.selectedIndex,
  isActive: (state: SelectStoreState, index: number) => state.activeIndex === index,

  isSelected: (state: SelectStoreState, itemValue: any) => {
    const comparer = state.isItemEqualToValue;
    const storeValue = state.value;

    if (state.multiple) {
      return Array.isArray(storeValue) && storeValue.some((selectedItem) => compareItemEquality(itemValue, selectedItem, comparer));
    }

    // The value is the source of truth: a stale `selectedIndex` (e.g. the controlled
    // value changes while the popup is open, where the index sync is deferred) must not
    // keep a previously selected item marked as selected.
    return compareItemEquality(itemValue, storeValue, comparer);
  },
  isSelectedByFocus: (state: SelectStoreState, index: number) => {
    return state.selectedIndex === index;
  },

  popupProps: (state: SelectStoreState) => state.popupProps,
  triggerProps: (state: SelectStoreState) => state.triggerProps,
  triggerElement: (state: SelectStoreState) => state.triggerElement,
  positionerElement: (state: SelectStoreState) => state.positionerElement,
  listElement: (state: SelectStoreState) => state.listElement,
  popupSide: (state: SelectStoreState) => state.popupSide,

  scrollUpArrowVisible: (state: SelectStoreState) => state.scrollUpArrowVisible,
  scrollDownArrowVisible: (state: SelectStoreState) => state.scrollDownArrowVisible,

  hasScrollArrows: (state: SelectStoreState) => state.hasScrollArrows,

  floatingRootContext: (state: SelectStoreState) => state.floatingRootContext,
};

export type SelectStoreSelectors = typeof selectors;

export function createInitialSelectStoreContext(): Omit<
  SelectStoreContext,
  "setValue" | "setOpen" | "handleScrollArrowVisibility" | "onOpenChangeComplete"
> {
  return {
    listRef: { current: [] },
    popupRef: { current: null },
    scrollHandlerRef: { current: null },
    scrollArrowsMountedCountRef: { current: 0 },
    valueRef: { current: null },
    valuesRef: { current: [] },
    labelsRef: { current: [] },
    typingRef: { current: false },
    selectionRef: {
      current: {
        allowSelectedMouseUp: false,
        allowUnselectedMouseUp: false,
        dragY: 0,
      },
    },
    firstItemTextRef: { current: null },
    selectedItemTextRef: { current: null },
    alignItemWithTriggerActiveRef: { current: false },
    initialValueRef: { current: null },
  };
}

/**
 * Headless store for the select. Mirrors upstream `ReactStore` state and selectors, using the
 * synchronous-snapshot + per-key version-signal pattern: the plain-object `snapshot` is the
 * single source of truth (Solid 2.0 batches signal writes, while interaction logic reads state
 * synchronously right after writing it), and one version signal per state key provides granular
 * reactivity — a `select` computation only re-runs when a raw field its selector actually read
 * changes.
 */
export class SelectStore {
  readonly context: SelectStoreContext;

  protected snapshot: SelectStoreState;

  private readonly keyVersions = new Map<string, { get: Accessor<number>; set: Setter<number> }>();

  /**
   * Proxy over the snapshot that subscribes the enclosing computation to
   * exactly the raw fields the selector reads for the given arguments.
   * Values always come from the synchronous snapshot.
   */
  private readonly trackingSnapshot: SelectStoreState;

  constructor(initialState: SelectStoreState, context: SelectStoreContext) {
    this.snapshot = initialState;
    this.context = context;

    for (const key of Object.keys(initialState)) {
      const [get, set] = createSignal(0, { ownedWrite: true });
      this.keyVersions.set(key, { get, set });
    }

    this.trackingSnapshot = new Proxy({} as SelectStoreState, {
      get: (_target, prop) => {
        if (typeof prop === "string") {
          this.trackKey(prop);
          return (this.snapshot as unknown as Record<string, unknown>)[prop];
        }
        return undefined;
      },
      has: (_target, prop) => Reflect.has(this.snapshot, prop),
      ownKeys: () => Reflect.ownKeys(this.snapshot),
      getOwnPropertyDescriptor: (_target, prop) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(this.snapshot, prop);
        if (descriptor !== undefined) {
          // The proxy target lacks the property, so the descriptor must be
          // configurable to satisfy proxy invariants.
          descriptor.configurable = true;
        }
        return descriptor;
      },
    });
  }

  private trackKey(key: string): void {
    let version = this.keyVersions.get(key);
    if (version === undefined) {
      const [get, set] = createSignal(0, { ownedWrite: true });
      version = { get, set };
      this.keyVersions.set(key, version);
    }
    version.get();
  }

  private bumpKey(key: string): void {
    this.keyVersions.get(key)?.set((prev) => prev + 1);
  }

  /**
   * The current state snapshot. Read inside a reactive computation to subscribe
   * to every key; prefer `select` for granular subscriptions.
   */
  get state(): SelectStoreState {
    for (const key of Object.keys(this.snapshot)) {
      this.trackKey(key);
    }
    return this.snapshot;
  }

  /**
   * Reads the current value for a state key through its selector. Reads must go through
   * the snapshot (never through signals) so synchronous interaction logic observes fresh writes.
   * Must only be called in a tracking scope (compute function, JSX, memo); the
   * computation subscribes only to the raw fields the selector reads.
   */
  select = (key: keyof SelectStoreSelectors, arg?: any): any => {
    return (selectors[key] as (state: SelectStoreState, arg?: any) => unknown)(this.trackingSnapshot, arg);
  };

  /**
   * Reads the current value for a state key without subscribing (same selector
   * as `select`). Use in event handlers, emitter listeners, timeouts, and
   * effect apply callbacks — anywhere a one-shot read must not track.
   */
  peek = (key: keyof SelectStoreSelectors, arg?: any): any => {
    return (selectors[key] as (state: SelectStoreState, arg?: any) => unknown)(this.snapshot, arg);
  };

  /**
   * Returns the current snapshot without subscribing. Use for one-shot reads
   * that must not track (same guidance as `peek`).
   */
  peekState = (): SelectStoreState => {
    return this.snapshot;
  };

  /**
   * Returns a reactive accessor for a state key (same selector as `select`).
   */
  useState = (key: keyof SelectStoreSelectors, arg?: any): Accessor<any> => {
    return () => this.select(key, arg);
  };

  /**
   * Merges the provided changes into the current state, writing only when at
   * least one value changed. Mirrors `Store.update` upstream.
   */
  update = (changes: Partial<SelectStoreState>) => {
    const changed: Array<keyof SelectStoreState> = [];
    for (const key of Object.keys(changes) as Array<keyof SelectStoreState>) {
      if (!Object.is(this.snapshot[key], changes[key])) {
        changed.push(key);
      }
    }
    if (changed.length === 0) {
      return;
    }
    this.snapshot = { ...this.snapshot, ...changes };
    for (const key of changed) {
      this.bumpKey(key as string);
    }
  };

  /**
   * Sets a single state key when the value changed. Mirrors `Store.set`.
   */
  set = <Key extends keyof SelectStoreState>(key: Key, value: SelectStoreState[Key]) => {
    if (!Object.is(this.snapshot[key], value)) {
      this.snapshot = { ...this.snapshot, [key]: value };
      this.bumpKey(key as string);
    }
  };

  /**
   * Synchronizes a single external value into the store. The value is read
   * through `getValue` so updates stay reactive; the state snapshot itself is
   * written synchronously. Mirrors `ReactStore.useSyncedValue` upstream.
   */
  useSyncedValue = <Key extends keyof SelectStoreState>(key: Key, getValue: () => SelectStoreState[Key]) => {
    createEffect(
      () => getValue(),
      (value) => {
        if (!Object.is(this.snapshot[key], value)) {
          this.set(key, value);
        }
      },
    );
  };

  /**
   * Synchronizes several external values into the store. Mirrors
   * `ReactStore.useSyncedValues` upstream.
   */
  useSyncedValues = (getValues: () => Partial<SelectStoreState>) => {
    createEffect(
      () => getValues(),
      (values) => {
        this.update(values);
      },
    );
  };
}

export function createInitialSelectStoreState(
  initialState: Partial<SelectStoreState> & { floatingRootContext: FloatingRootStore },
): SelectStoreState {
  const state: SelectStoreState = {
    id: undefined,
    labelId: undefined,
    modal: true,
    multiple: false,
    items: undefined,
    itemToStringLabel: undefined,
    itemToStringValue: undefined,
    isItemEqualToValue: defaultItemEquality,
    value: null,
    open: false,
    mounted: false,
    forceMount: false,
    transitionStatus: undefined,
    openMethod: null,
    activeIndex: null,
    selectedIndex: null,
    popupProps: EMPTY_OBJECT as Record<string, unknown>,
    triggerProps: EMPTY_OBJECT as Record<string, unknown>,
    triggerElement: null,
    positionerElement: null,
    listElement: null,
    popupSide: null,
    scrollUpArrowVisible: false,
    scrollDownArrowVisible: false,
    hasScrollArrows: false,
    ...initialState,
  };

  if (state.open && initialState.mounted === undefined) {
    state.mounted = true;
  }

  return state;
}

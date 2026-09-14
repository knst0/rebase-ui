import { type Accessor, createEffect, createSignal, type Setter } from "solid-js";

import type { FloatingRootStore } from "../../internals/floating/tree/FloatingRootStore";
import type { Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import type { TransitionStatus } from "../../internals/transition-status/createTransitionStatus";
import { EMPTY_OBJECT } from "#utils/empty";

import type { AriaCombobox } from "../root/AriaCombobox";
import { compareItemEquality } from "../../select/utils/itemEquality";
import { hasNullItemLabel } from "../../select/utils/resolveValueLabel";

export type ComboboxInteractionType = "keyboard" | "mouse" | "touch" | "pen" | "";

export type ComboboxStoreState = {
  id: string | undefined;
  labelId: string | undefined;

  items: readonly any[] | undefined;

  selectedValue: any;

  open: boolean;
  mounted: boolean;
  transitionStatus: TransitionStatus;
  forceMounted: boolean;

  inline: boolean;

  activeIndex: number | null;
  selectedIndex: number | null;

  popupProps: Record<string, unknown>;
  listProps: Record<string, unknown>;
  inputProps: Record<string, unknown>;
  triggerProps: Record<string, unknown>;
  itemProps: Record<string, unknown>;

  positionerElement: HTMLElement | null;
  listElement: HTMLElement | null;
  popupId: string | undefined;
  triggerElement: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  inputGroupElement: HTMLDivElement | null;
  popupSide: Side | null;

  openMethod: ComboboxInteractionType | null;

  inputInsidePopup: boolean;
  inputOwnsFormValue: boolean;

  selectionMode: "single" | "multiple" | "none";

  name: string | undefined;
  form: string | undefined;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  grid: boolean;
  virtualized: boolean;
  openOnInputClick: boolean;
  itemToStringLabel?: ((item: any) => string) | undefined;
  isItemEqualToValue: (itemValue: any, selectedValue: any) => boolean;
  modal: boolean;
  autoHighlight: false | "always" | "input-change";
  submitOnItemClick: boolean;
  hasInputValue: boolean;

  floatingRootContext: FloatingRootStore;
};

/**
 * Non-reactive values shared with the combobox parts. Nothing here is observable through
 * `selectors`, so writing to a ref never notifies subscribers.
 */
export type ComboboxStoreContext = {
  /** Item elements in list order, owned by `Combobox.List`. */
  readonly listRef: { current: Array<HTMLElement | null> };
  /** Item text labels in list order, used for typeahead. */
  readonly labelsRef: { current: Array<string | null> };
  /** The popup element. */
  readonly popupRef: { current: HTMLDivElement | null };
  /** The empty-state element. */
  readonly emptyRef: { current: HTMLDivElement | null };
  /** The input element that owns the combobox role. */
  readonly inputRef: { current: HTMLInputElement | null };
  /** Internal dismiss button rendered before the popup content. */
  readonly startDismissRef: { current: HTMLSpanElement | null };
  /** Internal dismiss button rendered after the popup content. */
  readonly endDismissRef: { current: HTMLSpanElement | null };
  /** Whether the last interaction came from the keyboard. */
  readonly keyboardActiveRef: { current: boolean };
  /** Container holding the selection chips. */
  readonly chipsContainerRef: { current: HTMLDivElement | null };
  /** The clear button. */
  readonly clearRef: { current: HTMLButtonElement | null };
  /** Item values in list order. */
  readonly valuesRef: { current: Array<any> };
  /** Item element that received the last pointerdown, to pair it with a mouseup. */
  readonly pointerDownItemRef: { current: Element | null };
  /** Native event that triggered the in-flight selection. */
  readonly selectionEventRef: { current: MouseEvent | PointerEvent | KeyboardEvent | null };

  // Commands. Seeded with `NOOP` when the store is constructed and assigned during the root's
  // first render, so they are not `readonly`.

  /** Opens or closes the popup. */
  setOpen: (open: boolean, eventDetails: AriaCombobox.ChangeEventDetails) => void;
  /** Sets the input value. */
  setInputValue: (value: string, eventDetails: AriaCombobox.ChangeEventDetails) => void;
  /** Sets the selected value. */
  setSelectedValue: (value: any, eventDetails: AriaCombobox.ChangeEventDetails) => void;
  /** Sets the active and/or selected index. */
  setIndices: (indices: {
    activeIndex?: number | null | undefined;
    selectedIndex?: number | null | undefined;
    type?: AriaCombobox.HighlightEventReason | undefined;
  }) => void;
  /** Mounts the popup subtree without opening it, to resolve derived item labels. */
  forceMount: () => void;
  /** Applies a selection originating from an item. */
  handleSelection: (event: MouseEvent | PointerEvent | KeyboardEvent, itemValue: any) => void;
  /** Requests submission of the owning form. */
  requestSubmit: () => void;
  /** Called when the open state change animation completes. */
  onOpenChangeComplete: (open: boolean) => void;
};

export const selectors = {
  id: (state: ComboboxStoreState) => state.id,
  labelId: (state: ComboboxStoreState) => state.labelId,

  items: (state: ComboboxStoreState) => state.items,

  selectedValue: (state: ComboboxStoreState) => state.selectedValue,
  hasSelectionChips: (state: ComboboxStoreState) => {
    const selectedValue = state.selectedValue;
    return Array.isArray(selectedValue) && selectedValue.length > 0;
  },

  hasSelectedValue: (state: ComboboxStoreState) => {
    const { selectedValue, selectionMode } = state;
    if (selectedValue == null) {
      return false;
    }
    if (selectionMode === "multiple" && Array.isArray(selectedValue)) {
      return selectedValue.length > 0;
    }
    return true;
  },

  hasNullItemLabel: (state: ComboboxStoreState, enabled: boolean) => {
    return enabled ? hasNullItemLabel(state.items) : false;
  },

  open: (state: ComboboxStoreState) => state.open,
  mounted: (state: ComboboxStoreState) => state.mounted,
  forceMounted: (state: ComboboxStoreState) => state.forceMounted,

  inline: (state: ComboboxStoreState) => state.inline,

  activeIndex: (state: ComboboxStoreState) => state.activeIndex,
  selectedIndex: (state: ComboboxStoreState) => state.selectedIndex,
  isActive: (state: ComboboxStoreState, index: number) => state.activeIndex === index,
  isSelected: (state: ComboboxStoreState, itemValue: any) => {
    const comparer = state.isItemEqualToValue;
    const selectedValue = state.selectedValue;
    if (Array.isArray(selectedValue)) {
      return selectedValue.some((selectedItem) =>
        compareItemEquality(itemValue, selectedItem, comparer),
      );
    }
    return compareItemEquality(itemValue, selectedValue, comparer);
  },

  transitionStatus: (state: ComboboxStoreState) => state.transitionStatus,

  popupProps: (state: ComboboxStoreState) => state.popupProps,
  listProps: (state: ComboboxStoreState) => state.listProps,
  inputProps: (state: ComboboxStoreState) => state.inputProps,
  triggerProps: (state: ComboboxStoreState) => state.triggerProps,
  itemProps: (state: ComboboxStoreState) => state.itemProps,

  positionerElement: (state: ComboboxStoreState) => state.positionerElement,
  listElement: (state: ComboboxStoreState) => state.listElement,
  popupId: (state: ComboboxStoreState) => state.popupId,
  triggerElement: (state: ComboboxStoreState) => state.triggerElement,
  inputElement: (state: ComboboxStoreState) => state.inputElement,
  inputGroupElement: (state: ComboboxStoreState) => state.inputGroupElement,
  popupSide: (state: ComboboxStoreState) => state.popupSide,

  openMethod: (state: ComboboxStoreState) => state.openMethod,

  inputInsidePopup: (state: ComboboxStoreState) => state.inputInsidePopup,
  inputOwnsFormValue: (state: ComboboxStoreState) => state.inputOwnsFormValue,

  selectionMode: (state: ComboboxStoreState) => state.selectionMode,

  name: (state: ComboboxStoreState) => state.name,
  form: (state: ComboboxStoreState) => state.form,
  disabled: (state: ComboboxStoreState) => state.disabled,
  readOnly: (state: ComboboxStoreState) => state.readOnly,
  required: (state: ComboboxStoreState) => state.required,
  grid: (state: ComboboxStoreState) => state.grid,
  virtualized: (state: ComboboxStoreState) => state.virtualized,
  openOnInputClick: (state: ComboboxStoreState) => state.openOnInputClick,
  itemToStringLabel: (state: ComboboxStoreState) => state.itemToStringLabel,
  isItemEqualToValue: (state: ComboboxStoreState) => state.isItemEqualToValue,
  modal: (state: ComboboxStoreState) => state.modal,
  autoHighlight: (state: ComboboxStoreState) => state.autoHighlight,
  submitOnItemClick: (state: ComboboxStoreState) => state.submitOnItemClick,
  hasInputValue: (state: ComboboxStoreState) => state.hasInputValue,

  floatingRootContext: (state: ComboboxStoreState) => state.floatingRootContext,
};

export type ComboboxStoreSelectors = typeof selectors;

export function createInitialComboboxStoreContext(): Omit<
  ComboboxStoreContext,
  | "setOpen"
  | "setInputValue"
  | "setSelectedValue"
  | "setIndices"
  | "forceMount"
  | "handleSelection"
  | "requestSubmit"
  | "onOpenChangeComplete"
> {
  return {
    listRef: { current: [] },
    labelsRef: { current: [] },
    popupRef: { current: null },
    emptyRef: { current: null },
    inputRef: { current: null },
    startDismissRef: { current: null },
    endDismissRef: { current: null },
    keyboardActiveRef: { current: true },
    chipsContainerRef: { current: null },
    clearRef: { current: null },
    valuesRef: { current: [] },
    pointerDownItemRef: { current: null },
    selectionEventRef: { current: null },
  };
}

/**
 * Headless store for the combobox. Mirrors upstream `ReactStore` state and selectors, using the
 * synchronous-snapshot + per-key version-signal pattern: the plain-object `snapshot` is the
 * single source of truth (Solid 2.0 batches signal writes, while interaction logic reads state
 * synchronously right after writing it), and one version signal per state key provides granular
 * reactivity — a `select` computation only re-runs when a raw field its selector actually read
 * changes.
 */
export class ComboboxStore {
  readonly context: ComboboxStoreContext;

  protected snapshot: ComboboxStoreState;

  private readonly keyVersions = new Map<string, { get: Accessor<number>; set: Setter<number> }>();

  /**
   * Proxy over the snapshot that subscribes the enclosing computation to
   * exactly the raw fields the selector reads for the given arguments.
   * Values always come from the synchronous snapshot.
   */
  private readonly trackingSnapshot: ComboboxStoreState;

  constructor(initialState: ComboboxStoreState, context: ComboboxStoreContext) {
    this.snapshot = initialState;
    this.context = context;

    for (const key of Object.keys(initialState)) {
      const [get, set] = createSignal(0, { ownedWrite: true });
      this.keyVersions.set(key, { get, set });
    }

    this.trackingSnapshot = new Proxy({} as ComboboxStoreState, {
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
  get state(): ComboboxStoreState {
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
  select = (key: keyof ComboboxStoreSelectors, arg?: any): any => {
    return (selectors[key] as (state: ComboboxStoreState, arg?: any) => unknown)(
      this.trackingSnapshot,
      arg,
    );
  };

  /**
   * Reads the current value for a state key without subscribing (same selector
   * as `select`). Use in event handlers, emitter listeners, timeouts, and
   * effect apply callbacks — anywhere a one-shot read must not track.
   */
  peek = (key: keyof ComboboxStoreSelectors, arg?: any): any => {
    return (selectors[key] as (state: ComboboxStoreState, arg?: any) => unknown)(
      this.snapshot,
      arg,
    );
  };

  /**
   * Returns the current snapshot without subscribing. Use for one-shot reads
   * that must not track (same guidance as `peek`).
   */
  peekState = (): ComboboxStoreState => {
    return this.snapshot;
  };

  /**
   * Returns a reactive accessor for a state key (same selector as `select`).
   */
  useState = (key: keyof ComboboxStoreSelectors, arg?: any): Accessor<any> => {
    return () => this.select(key, arg);
  };

  /**
   * Merges the provided changes into the current state, writing only when at
   * least one value changed. Mirrors `Store.update` upstream.
   */
  update = (changes: Partial<ComboboxStoreState>) => {
    const changed: Array<keyof ComboboxStoreState> = [];
    for (const key of Object.keys(changes) as Array<keyof ComboboxStoreState>) {
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
   * Sets a single state key when the value changed. Mirrors `Store.set` upstream.
   */
  set = <Key extends keyof ComboboxStoreState>(key: Key, value: ComboboxStoreState[Key]) => {
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
  useSyncedValue = <Key extends keyof ComboboxStoreState>(
    key: Key,
    getValue: () => ComboboxStoreState[Key],
  ) => {
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
  useSyncedValues = (getValues: () => Partial<ComboboxStoreState>) => {
    createEffect(
      () => getValues(),
      (values) => {
        this.update(values);
      },
    );
  };
}

export function createInitialComboboxStoreState(
  initialState: Partial<ComboboxStoreState> & { floatingRootContext: FloatingRootStore },
): ComboboxStoreState {
  const state: ComboboxStoreState = {
    id: undefined,
    labelId: undefined,
    items: undefined,
    selectedValue: null,
    open: false,
    mounted: false,
    transitionStatus: "idle",
    forceMounted: false,
    inline: false,
    activeIndex: null,
    selectedIndex: null,
    popupProps: EMPTY_OBJECT as Record<string, unknown>,
    listProps: EMPTY_OBJECT as Record<string, unknown>,
    inputProps: EMPTY_OBJECT as Record<string, unknown>,
    triggerProps: EMPTY_OBJECT as Record<string, unknown>,
    itemProps: EMPTY_OBJECT as Record<string, unknown>,
    positionerElement: null,
    listElement: null,
    popupId: undefined,
    triggerElement: null,
    inputElement: null,
    inputGroupElement: null,
    popupSide: null,
    openMethod: null,
    inputInsidePopup: false,
    inputOwnsFormValue: false,
    selectionMode: "single",
    name: undefined,
    form: undefined,
    disabled: false,
    readOnly: false,
    required: false,
    grid: false,
    virtualized: false,
    openOnInputClick: true,
    itemToStringLabel: undefined,
    isItemEqualToValue: Object.is,
    modal: false,
    autoHighlight: false,
    submitOnItemClick: false,
    hasInputValue: false,
    ...initialState,
  };

  return state;
}

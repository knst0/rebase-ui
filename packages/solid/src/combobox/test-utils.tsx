import { render } from "@solidjs/testing-library";
import type { JSX } from "@solidjs/web";
import { createSignal, type Accessor } from "solid-js";

import type { FloatingRootStore } from "../internals/floating/tree/FloatingRootStore";
import {
  ComboboxDerivedItemsContext,
  ComboboxInputValueContext,
  ComboboxRootContext,
  type ComboboxDerivedItemsContextValue,
} from "./root/ComboboxRootContext";
import {
  ComboboxStore,
  createInitialComboboxStoreContext,
  createInitialComboboxStoreState,
  type ComboboxStoreContext,
  type ComboboxStoreState,
} from "./store/ComboboxStore";

export interface RecordedCall {
  reason: unknown;
}

export interface ComboboxTestHarness {
  store: ComboboxStore;
  inputValue: Accessor<string>;
  derivedItems: ComboboxDerivedItemsContextValue;
  openCalls: Array<{ open: boolean; reason: unknown }>;
  inputValueCalls: Array<{ value: string; reason: unknown }>;
  selectedValueCalls: Array<{ value: unknown; reason: unknown }>;
  indicesCalls: Array<{ activeIndex?: number | null; selectedIndex?: number | null }>;
}

export interface ComboboxHarnessOptions {
  storeState?: Partial<ComboboxStoreState> | undefined;
  items?: Array<unknown> | undefined;
}

function readLabel(item: unknown): string {
  if (typeof item === "string") {
    return item;
  }
  if (item != null && typeof item === "object") {
    const record = item as Record<string, unknown>;
    const label = record.label ?? record.value;
    return typeof label === "string" ? label : String(label ?? "");
  }
  return String(item ?? "");
}

export function createComboboxHarness(options: ComboboxHarnessOptions = {}): ComboboxTestHarness {
  const [inputValue, setInputValueSignal] = createSignal("");
  const items = options.items ?? [];
  const state = createInitialComboboxStoreState({
    floatingRootContext: null as unknown as FloatingRootStore,
    id: "test-combobox",
    items: items as readonly unknown[],
    // Parts render outside a positioner unless a test opts into popup placement.
    inputInsidePopup: false,
    ...options.storeState,
  });
  const context = createInitialComboboxStoreContext() as unknown as ComboboxStoreContext;
  const store = new ComboboxStore(state, context);

  const harness: ComboboxTestHarness = {
    store,
    inputValue,
    derivedItems: {
      get query() {
        return inputValue();
      },
      get hasItems() {
        return items.length > 0;
      },
      get filteredItems() {
        const query = inputValue().trim().toLowerCase();
        if (!query) {
          return [...items];
        }
        return items.filter((item) => readLabel(item).toLowerCase().includes(query));
      },
      get flatFilteredValues() {
        return harness.derivedItems.filteredItems;
      },
    },
    openCalls: [],
    inputValueCalls: [],
    selectedValueCalls: [],
    indicesCalls: [],
  };

  context.setOpen = (open: boolean, details: { reason: unknown }) => {
    harness.openCalls.push({ open, reason: details.reason });
    store.set("open", open);
    if (open) {
      store.set("mounted", true);
    }
  };
  context.setInputValue = (value: string, details: { reason: unknown }) => {
    harness.inputValueCalls.push({ value, reason: details.reason });
    setInputValueSignal(value);
    store.set("hasInputValue", value !== "");
  };
  context.setSelectedValue = (value: unknown, details: { reason: unknown }) => {
    harness.selectedValueCalls.push({ value, reason: details.reason });
    store.set("selectedValue", value);
  };
  context.setIndices = (indices: { activeIndex?: number | null | undefined; selectedIndex?: number | null | undefined }) => {
    harness.indicesCalls.push({ ...indices });
    const patch: Partial<ComboboxStoreState> = {};
    if (indices.activeIndex !== undefined) {
      patch.activeIndex = indices.activeIndex;
    }
    if (indices.selectedIndex !== undefined) {
      patch.selectedIndex = indices.selectedIndex;
    }
    store.update(patch);
  };
  context.forceMount = () => {
    store.set("forceMounted", true);
  };
  context.handleSelection = () => {};
  context.requestSubmit = () => {};
  context.onOpenChangeComplete = () => {};

  return harness;
}

export function renderWithCombobox(ui: (harness: ComboboxTestHarness) => JSX.Element, options: ComboboxHarnessOptions = {}) {
  let harness!: ComboboxTestHarness;
  const result = render(() => {
    harness = createComboboxHarness(options);
    return (
      <ComboboxRootContext value={harness.store}>
        <ComboboxInputValueContext value={harness.inputValue}>
          <ComboboxDerivedItemsContext value={harness.derivedItems}>{ui(harness)}</ComboboxDerivedItemsContext>
        </ComboboxInputValueContext>
      </ComboboxRootContext>
    );
  });
  return { ...result, harness };
}

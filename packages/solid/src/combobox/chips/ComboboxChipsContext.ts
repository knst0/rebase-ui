import type { Accessor, Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";

export interface ComboboxChipsContext {
  highlightedChipIndex: Accessor<number | undefined>;
  setHighlightedChipIndex: Setter<number | undefined>;
  chipsRef: { current: Array<HTMLElement | null> };
}

export const ComboboxChipsContext = createContext<ComboboxChipsContext>();

export function useComboboxChipsContext(): ComboboxChipsContext | undefined {
  return useContext(ComboboxChipsContext);
}

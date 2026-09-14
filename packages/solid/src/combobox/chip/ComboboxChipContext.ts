import type { Accessor } from 'solid-js';

import { createContext, useContext } from '../../internals/context';

export interface ComboboxChipContext {
  index: Accessor<number>;
}

export const ComboboxChipContext = createContext<ComboboxChipContext>();

export function useComboboxChipContext(): ComboboxChipContext {
  const context = useContext(ComboboxChipContext);
  if (!context) {
    throw new Error(
      'Rebase UI: ComboboxChipContext is missing. ComboboxChip parts must be placed within <Combobox.Chip>.',
    );
  }
  return context;
}

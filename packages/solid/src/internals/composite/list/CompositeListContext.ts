import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../context";

export type CompositeMetadata<CustomMetadata> = { index: number } & CustomMetadata;

export interface CompositeListContext<Metadata = any> {
  register: (element: HTMLElement, metadata: Accessor<Metadata | undefined>) => void;
  unregister: (element: HTMLElement) => void;
  /** Document-order position of a registered element, or `-1`. Reactive and O(1). */
  indexOf: (element: HTMLElement | null) => number;
  map: Accessor<Map<HTMLElement, CompositeMetadata<Metadata>>>;
}

export const CompositeListContext = createContext<CompositeListContext>();

export function useCompositeListContext<Metadata>(): CompositeListContext<Metadata> {
  const value = useContext(CompositeListContext);
  if (value === undefined) {
    throw new Error("Rebase UI: CompositeListContext is missing. Composite list items must be placed within a composite list.");
  }

  return value;
}

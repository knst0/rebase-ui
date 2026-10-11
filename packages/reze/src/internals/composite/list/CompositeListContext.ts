import { createContext, useContext } from "reze-js";

export type CompositeMetadata<CustomMetadata> = { index: number } & CustomMetadata;

export interface CompositeListContext<Metadata = any> {
  register: (element: HTMLElement, metadata: () => Metadata | undefined) => void;
  unregister: (element: HTMLElement) => void;
  /** Document-order position of a registered element, or `-1`. Reactive and O(1). */
  indexOf: (element: HTMLElement | null) => number;
  map: () => Map<HTMLElement, CompositeMetadata<Metadata>>;
}

export const CompositeListContext = createContext<CompositeListContext<any> | undefined>(undefined);

export function useCompositeListContext<Metadata>(): CompositeListContext<Metadata> {
  const value = useContext(CompositeListContext);
  if (value === undefined) {
    throw new Error("Rebase UI: CompositeListContext is missing. Composite list items must be placed within a composite list.");
  }

  return value as CompositeListContext<Metadata>;
}

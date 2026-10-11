import { onCleanup } from "reze-js";

import { useCompositeListContext } from "./CompositeListContext";

export interface UseCompositeListItemParameters<Metadata> {
  metadata?: (() => Metadata) | undefined;
}

export interface UseCompositeListItemReturnValue {
  ref: (element: HTMLElement | null) => void;
  index: () => number;
}

export function useCompositeListItem<Metadata>(parameters: UseCompositeListItemParameters<Metadata> = {}): UseCompositeListItemReturnValue {
  const context = useCompositeListContext<Metadata>();

  let itemElement: HTMLElement | null = null;

  function ref(element: HTMLElement | null): void {
    if (itemElement !== null) {
      context.unregister(itemElement);
    }

    itemElement = element;

    if (element !== null) {
      context.register(element, () => parameters.metadata?.());
    }
  }

  onCleanup(() => {
    if (itemElement !== null) {
      context.unregister(itemElement);
    }
  });

  function index(): number {
    return context.indexOf(itemElement);
  }

  return { ref, index };
}

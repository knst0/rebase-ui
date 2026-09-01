import { onCleanup } from "solid-js";

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

  const ref = (element: HTMLElement | null) => {
    if (itemElement !== null) {
      context.unregister(itemElement);
    }

    itemElement = element;

    if (element !== null) {
      context.register(element, () => parameters.metadata?.());
    }
  };

  onCleanup(() => {
    if (itemElement !== null) {
      context.unregister(itemElement);
    }
  });

  const index = () => (itemElement === null ? -1 : (context.map().get(itemElement)?.index ?? -1));

  return { ref, index };
}

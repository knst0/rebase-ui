import { type Accessor, createMemo, createSignal } from "solid-js";

import { sortByDocumentPosition } from "../composite";
import type { CompositeListContext, CompositeMetadata } from "./CompositeListContext";

export interface CreateCompositeListReturnValue<Metadata> {
  contextValue: CompositeListContext<Metadata>;
  elements: Accessor<HTMLElement[]>;
  map: Accessor<Map<HTMLElement, CompositeMetadata<Metadata>>>;
}

/**
 * Tracks a list of items and their index (DOM position) without taking over
 * their focus behavior. Use `createCompositeRoot` instead when the items form
 * a roving tab stop.
 */
export function createCompositeList<Metadata>(): CreateCompositeListReturnValue<Metadata> {
  const [elements, setElements] = createSignal<HTMLElement[]>([]);
  const [metadataMap, setMetadataMap] = createSignal(new Map<HTMLElement, Accessor<Metadata | undefined>>());

  const register = (element: HTMLElement, metadata: Accessor<Metadata | undefined>) => {
    setMetadataMap((previous) => new Map(previous).set(element, metadata));
    setElements((previous) => sortByDocumentPosition(previous, element));
  };

  const unregister = (element: HTMLElement) => {
    setMetadataMap((previous) => {
      if (!previous.has(element)) {
        return previous;
      }
      const next = new Map(previous);
      next.delete(element);
      return next;
    });
    setElements((previous) => previous.filter((current) => current !== element));
  };

  const map = createMemo(() => {
    const items = elements();
    const metadata = metadataMap();
    const next = new Map<HTMLElement, CompositeMetadata<Metadata>>();

    for (let index = 0; index < items.length; index += 1) {
      const element = items[index];
      next.set(element, { ...(metadata.get(element)?.() ?? ({} as Metadata)), index });
    }

    return next;
  });

  return { contextValue: { register, unregister, map }, elements, map };
}

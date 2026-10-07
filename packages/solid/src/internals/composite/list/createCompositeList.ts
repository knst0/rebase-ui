import { type Accessor, createMemo } from "solid-js";

import { createElementRegistry } from "../registry/createElementRegistry";
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
  const registry = createElementRegistry<Metadata>();

  const map = createMemo(() => {
    const items = registry.elements();
    const next = new Map<HTMLElement, CompositeMetadata<Metadata>>();

    for (let index = 0; index < items.length; index += 1) {
      const element = items[index];
      next.set(element, { ...(registry.metadataOf(element) ?? ({} as Metadata)), index });
    }

    return next;
  });

  const contextValue: CompositeListContext<Metadata> = {
    register: registry.register,
    unregister: registry.unregister,
    indexOf: registry.indexOf,
    map,
  };

  return { contextValue, elements: registry.elements, map };
}

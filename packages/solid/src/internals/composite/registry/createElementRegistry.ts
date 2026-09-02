import { type Accessor, createMemo, createSignal } from "solid-js";

import { orderByDocumentPosition } from "./documentOrder";

export type ElementMetadata<Metadata> = Metadata | Accessor<Metadata | undefined> | undefined;

export interface ElementRegistry<Metadata> {
  register: (element: HTMLElement, metadata?: ElementMetadata<Metadata>) => void;
  unregister: (element: HTMLElement) => void;
  /** Registered elements in document order. Recomputed once per batch, not per registration. */
  elements: Accessor<HTMLElement[]>;
  /** Document-order position of an element, or `-1`. Reactive, but O(1) per read. */
  indexOf: (element: HTMLElement | null) => number;
  /** Resolves the metadata stored for an element. Tracks accessor metadata. */
  metadataOf: (element: HTMLElement) => Metadata | undefined;
}

export function createElementRegistry<Metadata>(): ElementRegistry<Metadata> {
  const entries = new Map<HTMLElement, ElementMetadata<Metadata>>();
  const [version, setVersion] = createSignal(0, { ownedWrite: true });

  let indices = new WeakMap<HTMLElement, number>();

  const register = (element: HTMLElement, metadata?: ElementMetadata<Metadata>) => {
    entries.set(element, metadata);
    setVersion((current) => current + 1);
  };

  const unregister = (element: HTMLElement) => {
    if (!entries.delete(element)) {
      return;
    }
    setVersion((current) => current + 1);
  };

  const elements = createMemo(() => {
    version();

    const list = orderByDocumentPosition(entries.keys());

    const next = new WeakMap<HTMLElement, number>();
    for (let index = 0; index < list.length; index += 1) {
      next.set(list[index], index);
    }
    indices = next;

    return list;
  });

  const indexOf = (element: HTMLElement | null) => {
    elements();
    return element === null ? -1 : (indices.get(element) ?? -1);
  };

  const metadataOf = (element: HTMLElement) => {
    const metadata = entries.get(element);
    return typeof metadata === "function" ? (metadata as Accessor<Metadata | undefined>)() : metadata;
  };

  return { register, unregister, elements, indexOf, metadataOf };
}

import type { JSX } from "@solidjs/web";
import { For } from "solid-js";

import { useComboboxDerivedItemsContext } from "../root/ComboboxRootContext";
import { useGroupCollectionContext } from "./GroupCollectionContext";

/**
 * Renders filtered list items.
 * Doesn't render its own HTML element.
 *
 * If rendering a flat list, pass a function child to the `List` component instead, which implicitly wraps it.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxCollection(props: ComboboxCollection.Props): JSX.Element {
  const derived = useComboboxDerivedItemsContext();
  const groupContext = useGroupCollectionContext();

  // A nested group scopes the collection to its own `items`; otherwise the
  // root-level filtered items render. `For` reconciles by item identity so
  // filtering keeps mounted items (and their highlight state) stable.
  const itemsToRender = () =>
    (groupContext?.items ?? derived.filteredItems) as readonly unknown[];

  return <For each={itemsToRender()}>{(item, index) => props.children(item, index())}</For>;
}

export interface ComboboxCollectionState {}

export interface ComboboxCollectionProps {
  /**
   * Renders one filtered item. The item type is opaque here; annotate it at the
   * call site.
   */
  children: (item: any, index: number) => JSX.Element;
}

export namespace ComboboxCollection {
  export type State = ComboboxCollectionState;
  export type Props = ComboboxCollectionProps;
}

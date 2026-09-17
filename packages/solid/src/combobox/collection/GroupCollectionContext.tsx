import type { JSX } from "@solidjs/web";

import { createContext, useContext } from "../../internals/context";

export interface GroupCollectionContextValue {
  items: readonly unknown[];
}

export const GroupCollectionContext = createContext<GroupCollectionContextValue>();

export function useGroupCollectionContext(): GroupCollectionContextValue | undefined {
  return useContext(GroupCollectionContext);
}

export function GroupCollectionProvider(props: { children: JSX.Element; items: readonly unknown[] }): JSX.Element {
  const contextValue: GroupCollectionContextValue = { items: props.items };
  return <GroupCollectionContext value={contextValue}>{props.children}</GroupCollectionContext>;
}

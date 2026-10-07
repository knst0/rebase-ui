import { type JSX } from "@solidjs/web";
import { createContext, createEffect, createMemo, createUniqueId, untrack, useContext } from "solid-js";

import type { FloatingNodeType } from "../types";
import { FloatingTreeStore } from "./FloatingTreeStore";

const FloatingNodeContext = createContext<FloatingNodeType | null>(null);
const FloatingTreeContext = createContext<FloatingTreeStore | null>(null);

/**
 * Returns the parent node id for nested floating elements, if available.
 * Returns `null` for top-level floating elements.
 */
export function useFloatingParentNodeId(): string | null {
  return useContext(FloatingNodeContext)?.id ?? null;
}

/**
 * Returns the nearest floating tree context, if available.
 */
export function useFloatingTree(externalTree?: FloatingTreeStore): FloatingTreeStore | null {
  const contextTree = useContext(FloatingTreeContext);
  return externalTree ?? contextTree;
}

/**
 * Registers a node into the `FloatingTree`, returning its id.
 * @see https://floating-ui.com/docs/FloatingTree
 */
export function useFloatingNodeId(externalTree?: FloatingTreeStore): string {
  const id = createUniqueId();
  const tree = useFloatingTree(externalTree);
  const parentId = useFloatingParentNodeId();

  createEffect(
    () => ({ tree, id, parentId }),
    ({ tree: currentTree, id: currentId, parentId: currentParentId }) => {
      if (!currentId) {
        return undefined;
      }

      const node: FloatingNodeType = { id: currentId, parentId: currentParentId };
      currentTree?.addNode(node);
      return () => {
        currentTree?.removeNode(node);
      };
    },
  );

  return id;
}

export interface FloatingNodeProps {
  children?: JSX.Element;
  id: string | undefined;
}

/**
 * Provides parent node context for nested floating elements.
 * @see https://floating-ui.com/docs/FloatingTree
 * @internal
 */
export function FloatingNode(props: FloatingNodeProps): JSX.Element {
  const parentId = useFloatingParentNodeId();
  const value = createMemo<FloatingNodeType>(() => ({
    id: untrack(() => props.id),
    parentId,
  }));

  // Intentional one-shot read: the memo has no reactive dependencies (the id is consumed
  // untracked by design), so there is nothing to subscribe to here.
  return <FloatingNodeContext value={untrack(value)}>{props.children}</FloatingNodeContext>;
}

export interface FloatingTreeProps {
  children?: JSX.Element;
  externalTree?: FloatingTreeStore | undefined;
}

/**
 * Provides context for nested floating elements when they are not children of
 * each other on the DOM.
 * This is not necessary in all cases, except when there must be explicit communication between parent and child floating elements. It is necessary for:
 * - The `bubbles` option in the `useDismiss()` Hook
 * - Nested virtual list navigation
 * - Nested floating elements that each open on hover
 * - Custom communication between parent and child floating elements
 * @see https://floating-ui.com/docs/FloatingTree
 * @internal
 */
export function FloatingTree(props: FloatingTreeProps): JSX.Element {
  const tree = untrack(() => props.externalTree ?? new FloatingTreeStore());
  return <FloatingTreeContext value={tree}>{props.children}</FloatingTreeContext>;
}

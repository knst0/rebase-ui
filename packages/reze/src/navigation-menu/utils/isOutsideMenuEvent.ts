import type { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import { contains } from "../../internals/floating/utils/element";
import { getNodeChildren } from "../../internals/floating/utils/nodes";

interface Targets {
  currentTarget: Element | null;
  relatedTarget: Element | null;
}

interface Params {
  popupElement: HTMLElement | null;
  rootElement: HTMLElement | null;
  tree: FloatingTreeStore | null;
  nodeId: string | undefined;
}

export function isOutsideMenuEvent({ currentTarget, relatedTarget }: Targets, params: Params) {
  const { popupElement, rootElement, tree, nodeId } = params;

  const nodeChildrenContains = tree
    ? getNodeChildren(tree.nodesRef.current, nodeId).some((node) => contains(node.context?.elements.floating, relatedTarget))
    : false;

  if (!popupElement) {
    return !contains(rootElement, relatedTarget) && !nodeChildrenContains;
  }

  return (
    !contains(popupElement, currentTarget) &&
    !contains(popupElement, relatedTarget) &&
    !contains(rootElement, relatedTarget) &&
    !nodeChildrenContains
  );
}

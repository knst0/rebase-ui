import { getWindow as ownerWindow } from "@floating-ui/utils/dom";

export { ownerWindow };

export function ownerDocument(node: Element | null | undefined) {
  return node?.ownerDocument || document;
}

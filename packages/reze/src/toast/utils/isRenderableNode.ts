export function isRenderableNode(node: unknown): boolean {
  if (node == null || typeof node === "boolean" || node === "") {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some(isRenderableNode);
  }
  return true;
}

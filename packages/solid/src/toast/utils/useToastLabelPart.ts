import { createEffect, createUniqueId, type Setter } from "solid-js";

import { useToastRootContext } from "../root/ToastRootContext";
import { isRenderableNode } from "./isRenderableNode";

/**
 * Shared logic for `Toast.Title` and `Toast.Description`, which only differ by the rendered tag,
 * the fallback content, and which id setter they register with. Resolves the content and returns
 * the pieces each part passes to `RenderElement`, registering the id with the root while
 * the part renders.
 */
export function useToastLabelPart(getIdProp: () => string | undefined, getChildrenProp: () => unknown, part: "title" | "description") {
  const context = useToastRootContext();

  const setId: Setter<string | undefined> = part === "title" ? context.setTitleId : context.setDescriptionId;
  const generatedId = createUniqueId();
  const id = getIdProp() ?? generatedId;

  const children = () => {
    const explicit = getChildrenProp();
    if (explicit !== undefined) {
      return explicit;
    }
    const toast = context.toast();
    return part === "title" ? toast.title : toast.description;
  };

  // Mounts the label only when it carries renderable content, registering the
  // id with the root while the part renders.
  const shouldRender = () => isRenderableNode(children());

  createEffect(
    () => (shouldRender() ? id : undefined),
    (currentId) => {
      if (currentId === undefined) {
        return undefined;
      }
      setId(currentId);
      return () => {
        setId((current) => (current === currentId ? undefined : current));
      };
    },
  );

  return { id, children, shouldRender, type: () => context.toast().type };
}

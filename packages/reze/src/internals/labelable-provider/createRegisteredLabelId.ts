import { createUniqueId, effect, onCleanup } from "reze-js";

export type RegisteredLabelIdSetter = (next: string | undefined | ((prev: string | undefined) => string | undefined)) => void;

/**
 * Generates a stable label id (honoring an explicit `id` prop) and registers it
 * with the owner via `setLabelId`, keeping the registration in sync when the
 * prop changes and clearing it on cleanup. Mirrors the Solid helper.
 */
export function createRegisteredLabelId(idProp: () => string | undefined, setLabelId: RegisteredLabelIdSetter): () => string | undefined {
  const generatedId = createUniqueId();

  function id(): string | undefined {
    return idProp() ?? generatedId;
  }

  effect(() => {
    const currentId = id();
    setLabelId(currentId);

    onCleanup(() => {
      setLabelId((prev) => (prev === currentId ? undefined : prev));
    });
  });

  return id;
}

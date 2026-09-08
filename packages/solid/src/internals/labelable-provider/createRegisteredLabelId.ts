import { type Accessor, createEffect, createUniqueId, type Setter } from "solid-js";

export function createRegisteredLabelId(
  idProp: Accessor<string | undefined>,
  setLabelId: Setter<string | undefined>,
): Accessor<string | undefined> {
  const generatedId = createUniqueId();
  const id = () => idProp() ?? generatedId;

  createEffect(
    () => ({ currentId: id() }),
    ({ currentId }) => {
      setLabelId(currentId);

      return () => {
        setLabelId((prev) => (prev === currentId ? undefined : prev));
      };
    },
  );

  return id;
}

import { type Accessor, createEffect, createSignal } from "solid-js";

/**
 * Solid equivalent of Base UI's `useIsHydrating`: `true` while server-rendering
 * or hydrating, `false` once the component's effects have run on the client.
 */
export function createIsHydrating(): Accessor<boolean> {
  const [hydrated, setHydrated] = createSignal(false);

  createEffect(
    () => 0,
    () => {
      setHydrated(true);
    },
  );

  return () => !hydrated();
}

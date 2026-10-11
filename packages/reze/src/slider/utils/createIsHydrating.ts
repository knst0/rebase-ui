import { effect, store, untrack } from "reze-js";

/**
 * Reze equivalent of Base UI's `useIsHydrating`: `true` while server-rendering
 * or hydrating, `false` once the component's effects have run on the client.
 */
export function createIsHydrating(): () => boolean {
  const state = store({ hydrated: false });

  effect(() => {
    untrack(() => {
      if (!state.hydrated) {
        state.hydrated = true;
      }
    });
  });

  return () => !state.hydrated;
}

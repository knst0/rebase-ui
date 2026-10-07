import type { JSX } from "@solidjs/web";

/**
 * Merges an internally computed style with the user-provided `style` prop
 * (which may be an object or a function of the component state),
 * mirroring how Base UI merges `style` across `useRenderElement` prop layers.
 * User-provided declarations win on conflict.
 */
export function mergeStyles<State>(
  state: State,
  base: JSX.CSSProperties | undefined,
  user: JSX.CSSProperties | ((state: State) => JSX.CSSProperties | undefined) | undefined,
): JSX.CSSProperties | undefined {
  const resolved = typeof user === "function" ? user(state) : user;

  if (base === undefined) {
    return resolved;
  }

  if (resolved === undefined) {
    return base;
  }

  return { ...base, ...resolved };
}

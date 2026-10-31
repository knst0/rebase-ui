import { effect, onCleanup, untrack } from "reze-js";

// Tracks `compute` and runs `apply` untracked, disposing what `apply` returns on the next run.
export function watch<T>(compute: () => T, apply: (value: T) => void | (() => void)) {
  effect(() => {
    const value = compute();
    const dispose = untrack(() => apply(value));
    if (dispose) {
      onCleanup(dispose);
    }
  });
}

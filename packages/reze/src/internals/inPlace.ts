import { untrack } from "reze-js";

// A dynamic tag returns a thunk that its parent's insert effect evaluates, outside the providers
// surrounding this part. Evaluating it here keeps them; `as` is resolved once, as elsewhere.
export function inPlace<T>(element: T): T {
  let current: unknown = element;
  while (typeof current === "function") {
    const thunk = current as () => unknown;
    current = untrack(thunk);
  }
  return current as T;
}

import { onCleanup } from "solid-js";

export interface ScrollAreaTimeout {
  start: (ms: number, fn: () => void) => void;
  clear: () => void;
}

export function createTimeout(): ScrollAreaTimeout {
  let id: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    if (id !== undefined) {
      clearTimeout(id);
      id = undefined;
    }
  };

  onCleanup(clear);

  return {
    start: (ms, fn) => {
      clear();
      id = setTimeout(() => {
        id = undefined;
        fn();
      }, ms);
    },
    clear,
  };
}

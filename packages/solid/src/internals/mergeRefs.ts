type Ref<T> = ((element: T) => void) | null | undefined;

export function mergeRefs<I>(...refs: Ref<I>[]): (element: I) => void {
  return (element) => {
    for (const ref of refs) {
      if (ref) {
        ref(element);
      }
    }
  };
}

export function stableCallback<T extends (...args: any[]) => any>(
  get: () => T | undefined,
): T {
  return ((...args: any[]) => get()?.(...args)) as T;
}

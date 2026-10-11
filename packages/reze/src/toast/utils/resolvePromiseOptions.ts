import type { ToastManagerUpdateOptions } from "../useToastManager";

export function resolvePromiseOptions<Value, Data extends object>(
  options: string | ToastManagerUpdateOptions<Data> | ((result: Value) => string | ToastManagerUpdateOptions<Data>),
  result?: Value,
): ToastManagerUpdateOptions<Data> {
  if (typeof options === "string") {
    return {
      description: options,
    };
  }

  if (typeof options === "function") {
    const resolvedOptions = options(result as Value);
    return typeof resolvedOptions === "string" ? { description: resolvedOptions } : resolvedOptions;
  }

  return options;
}

import { store, untrack } from "reze-js";

export interface ControllableProps<T> {
  value: () => T | undefined;
  defaultValue: () => T | undefined;
  onChange?: (value: T) => void;
}

export interface ControllablePropsWithDefaultValue<T> extends Omit<ControllableProps<T>, "defaultValue"> {
  defaultValue: () => T;
}

export function createControllableSignal<T>(props: ControllablePropsWithDefaultValue<T>): [() => T, (next: T) => void];
export function createControllableSignal<T>(props: ControllableProps<T>): [() => T | undefined, (next: T) => void] {
  // Unlike Solid's createSignal, the store adopts function values as-is instead of calling them.
  const internal = store({ value: untrack(() => props.defaultValue()) as T | undefined });

  function value(): T | undefined {
    const controlledValue = props.value();
    return controlledValue !== undefined ? controlledValue : internal.value;
  }

  function setValue(next: T) {
    if (untrack(() => props.value()) === undefined) {
      internal.value = next;
    }
    props.onChange?.(next);
  }

  return [value, setValue];
}

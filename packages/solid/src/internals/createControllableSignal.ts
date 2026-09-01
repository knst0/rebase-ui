import { createSignal, type Accessor, untrack, createMemo } from "solid-js";

export interface ControllableProps<T> {
  value: Accessor<T | undefined>;
  defaultValue: Accessor<T | undefined>;
  onChange: (value: T) => void;
}

export interface ControllablePropsWithDefaultValue<T> extends Omit<ControllableProps<T>, "defaultValue"> {
  defaultValue: Accessor<T>;
}

export function createControllableSignal<T>(props: ControllablePropsWithDefaultValue<T>): [Accessor<T>, (next: T) => void];
export function createControllableSignal<T>(props: ControllableProps<T>): [Accessor<T | undefined>, (next: T) => void] {
  const [internalValue, setInternalValue] = createSignal<T | undefined>(untrack(props.defaultValue) as Exclude<T, Function> | undefined);

  const value = createMemo(() => {
    const controlledValue = props.value();
    return controlledValue !== undefined ? controlledValue : internalValue();
  });

  const setValue = (next: T) => {
    if (untrack(props.value) === undefined) {
      setInternalValue(() => next);
    }
    props.onChange(next);
  };

  return [value, setValue];
}

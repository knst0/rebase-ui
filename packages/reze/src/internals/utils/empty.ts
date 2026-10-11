export type Setter<T> = (value: T | ((previous: T) => T)) => void;

export const NOOP = () => {};

export const NOOP_SETTER = NOOP as unknown as Setter<any>;

export const EMPTY_ARRAY: readonly any[] = Object.freeze([]);

export const EMPTY_OBJECT = Object.freeze({});

export const EMPTY_STATE_MAPPING = Object.freeze({ keys: EMPTY_ARRAY, map: () => null });

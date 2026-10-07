import type { Setter } from "solid-js";

export const NOOP = () => {};

export const NOOP_SETTER = NOOP as unknown as Setter<any>;

export const EMPTY_ARRAY: readonly any[] = Object.freeze([]);

export const EMPTY_OBJECT = Object.freeze({});

export const EMPTY_STATE_MAPPING = Object.freeze({ keys: EMPTY_ARRAY, map: () => null });

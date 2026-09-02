export function NOOP() {}

export const EMPTY_ARRAY: readonly any[] = Object.freeze([]);

export const EMPTY_OBJECT = Object.freeze({});

export const EMPTY_STATE_MAPPING = Object.freeze({ keys: EMPTY_ARRAY, map: () => null });

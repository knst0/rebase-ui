import { type Accessor, createRenderEffect } from "solid-js";

type UnwrapAccessor<T> = T extends () => infer R ? R : T;

export interface StateAttributeMapping<Value> {
  keys: readonly string[];
  map: (value: Value) => Record<string, string> | null;
}

export type StateAttributesMapping<State> = {
  [Property in keyof State]?: StateAttributeMapping<UnwrapAccessor<State[Property]>>;
};

type AnyMapping = Record<string, StateAttributeMapping<any> | undefined>;

export function toStateAttributeValue(value: unknown): string | undefined {
  if (value === true) return "";
  if (value === false || value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return undefined;
}

function unwrapStateValue(value: unknown): unknown {
  if (typeof value === "function") {
    return (value as () => unknown)();
  }
  return value;
}

function define(target: Record<string, any>, name: string, get: () => string | undefined) {
  Object.defineProperty(target, name, { enumerable: true, configurable: true, get });
}

export function getStateAttributes<State extends Record<string, Accessor<unknown>>>(
  state: State,
  customMapping?: StateAttributesMapping<State>,
): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (customMapping !== undefined) {
    const mappings = customMapping as AnyMapping;

    for (const key in mappings) {
      const mapping = mappings[key];
      if (mapping === undefined || !(key in state)) {
        continue;
      }

      for (const name of mapping.keys) {
        define(attributes, name, () => mapping.map(unwrapStateValue(state[key]))?.[name]);
      }
    }

    return attributes;
  }

  for (const key in state) {
    define(attributes, `data-${key.toLowerCase()}`, () => toStateAttributeValue(unwrapStateValue(state[key])));
  }

  return attributes;
}

const TRANSPARENT = { transparent: true } as const;

type AttributeStep =
  | { mapping: undefined; read: () => unknown; name: string }
  | { mapping: StateAttributeMapping<any>; read: () => unknown; name: undefined };

export function applyStateAttributes<State extends Record<string, Accessor<unknown>>>(
  element: Element,
  state: State,
  customMapping: StateAttributesMapping<State> | undefined,
  ownedByProps: Record<string, unknown>,
): void {
  const steps: AttributeStep[] = [];

  for (const key in state) {
    const mapping = customMapping?.[key];
    const read = () => unwrapStateValue(state[key]);

    if (mapping !== undefined) {
      if (mapping.keys.some((name) => !(name in ownedByProps))) {
        steps.push({ mapping, read, name: undefined });
      }
      continue;
    }

    const name = `data-${key.toLowerCase()}`;
    if (!(name in ownedByProps)) {
      steps.push({ mapping: undefined, read, name });
    }
  }

  if (steps.length === 0) {
    return;
  }

  let applied = new Map<string, string>();

  createRenderEffect(
    () => {
      const next = new Map<string, string>();

      for (const step of steps) {
        if (step.mapping === undefined) {
          const value = toStateAttributeValue(step.read());
          if (value !== undefined) {
            next.set(step.name, value);
          }
          continue;
        }

        const attributes = step.mapping.map(step.read());
        if (attributes === null) {
          continue;
        }

        for (const name in attributes) {
          if (!(name in ownedByProps)) {
            next.set(name, attributes[name]);
          }
        }
      }

      return next;
    },
    (next) => {
      for (const [name, value] of next) {
        if (applied.get(name) !== value) {
          element.setAttribute(name, value);
        }
      }

      for (const name of applied.keys()) {
        if (!next.has(name)) {
          element.removeAttribute(name);
        }
      }

      applied = next;
    },
    TRANSPARENT,
  );
}

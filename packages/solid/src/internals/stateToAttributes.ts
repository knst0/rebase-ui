import { $PROXY, type Accessor, createRenderEffect, untrack } from "solid-js";

type UnwrapAccessor<T> = T extends () => infer R ? R : T;

export type StateAttributesMapping<State> = {
  [Property in keyof State]?: (state: UnwrapAccessor<State[Property]>) => Record<string, string> | null;
};

/**
 * Coerce a single state value into a `data-*` attribute value.
 * Returns `undefined` when the attribute should be omitted entirely.
 */
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

/**
 * Convert a state object to `data-*` attributes.
 */
export function getStateAttributes<State extends Record<string, Accessor<unknown>>>(
  state: State,
  customMapping?: StateAttributesMapping<State>,
): Record<string, string> {
  const attributes: Record<string, string> = {};
  const mappings: Array<() => Record<string, string>> = [];

  for (const key in state) {
    const attributeName = `data-${key.toLowerCase()}`;

    if (customMapping?.hasOwnProperty(key)) {
      const mapKey = customMapping as Record<string, ((value: unknown) => Record<string, string> | null) | undefined>;
      const evaluate = () => mapKey[key]?.(unwrapStateValue(state[key])) ?? {};

      mappings.push(evaluate);

      Object.defineProperty(attributes, attributeName, {
        enumerable: true,
        configurable: true,
        get() {
          return evaluate()[attributeName];
        },
      });
      continue;
    }

    Object.defineProperty(attributes, attributeName, {
      enumerable: true,
      configurable: true,
      get() {
        return toStateAttributeValue(unwrapStateValue(state[key]));
      },
    });
  }

  if (mappings.length === 0) {
    return attributes;
  }

  const seenNames = new Set<string>();

  const mappedAttributes = () => {
    const merged: Record<string, string> = {};
    for (const evaluate of mappings) {
      for (const [name, value] of Object.entries(evaluate())) {
        merged[name] = value;
        seenNames.add(name);
      }
    }
    return merged;
  };

  return new Proxy(attributes, {
    get(target, key, receiver) {
      if (typeof key === "string" && !Object.prototype.hasOwnProperty.call(target, key)) {
        const merged = mappedAttributes();
        if (seenNames.has(key)) return merged[key];
      }
      return Reflect.get(target, key, receiver);
    },
    has(target, key) {
      if (key === $PROXY) return true;
      if (typeof key === "string" && !Reflect.has(target, key)) {
        untrack(mappedAttributes);
        return seenNames.has(key);
      }
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      untrack(mappedAttributes);
      return [...new Set([...Reflect.ownKeys(target), ...seenNames])];
    },
    getOwnPropertyDescriptor(target, key) {
      const own = Reflect.getOwnPropertyDescriptor(target, key);
      if (own !== undefined) return own;
      if (typeof key !== "string") return undefined;

      untrack(mappedAttributes);
      if (!seenNames.has(key)) return undefined;

      return {
        enumerable: true,
        configurable: true,
        get: () => mappedAttributes()[key],
      };
    },
  });
}

function setAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

function removeAttribute(element: Element, name: string) {
  if (element.hasAttribute(name)) {
    element.removeAttribute(name);
  }
}

const TRANSPARENT = { transparent: true } as const;

export function applyStateAttributes<State extends Record<string, Accessor<unknown>>>(
  element: Element,
  state: State,
  customMapping: StateAttributesMapping<State> | undefined,
  ownedByProps: Record<string, unknown>,
): void {
  for (const key in state) {
    const mapping = customMapping?.hasOwnProperty(key)
      ? (customMapping as Record<string, ((value: unknown) => Record<string, string> | null) | undefined>)[key]
      : undefined;

    if (mapping !== undefined) {
      let applied: string[] = [];

      createRenderEffect(
        () => mapping(unwrapStateValue(state[key])),
        (attributes) => {
          const next = attributes ?? undefined;

          for (const name of applied) {
            if (next === undefined || !(name in next)) removeAttribute(element, name);
          }

          applied = [];
          if (next === undefined) return;

          for (const name in next) {
            if (name in ownedByProps) continue;
            applied.push(name);
            setAttribute(element, name, next[name]);
          }
        },
        TRANSPARENT,
      );
      continue;
    }

    const name = `data-${key.toLowerCase()}`;
    if (name in ownedByProps) continue;

    createRenderEffect(
      () => toStateAttributeValue(unwrapStateValue(state[key])),
      (value) => {
        if (value === undefined) removeAttribute(element, name);
        else setAttribute(element, name, value);
      },
      TRANSPARENT,
    );
  }
}

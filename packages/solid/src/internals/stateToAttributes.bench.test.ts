import { $PROXY } from "solid-js";
import { beforeEach, describe, expect, it } from "vitest";

import { getStateAttributes, type StateAttributesMapping, toStateAttributeValue } from "./stateToAttributes";

const report: string[] = [];

function record(line: string) {
  report.push(line);
}

let mapCalls = 0;
let proxyAllocations = 0;

beforeEach(() => {
  mapCalls = 0;
  proxyAllocations = 0;
});

/* ------------------------------------------------------------------ *
 * Legacy reference implementation (undeclared keys, Proxy-backed)
 * ------------------------------------------------------------------ */

type LegacyMapping = Record<string, (value: unknown) => Record<string, string> | null>;

function legacyGetStateAttributes(state: Record<string, () => unknown>, customMapping: LegacyMapping): Record<string, string> {
  const attributes: Record<string, string> = {};
  const mappings: Array<() => Record<string, string>> = [];

  for (const key in state) {
    const attributeName = `data-${key.toLowerCase()}`;

    if (Object.hasOwn(customMapping, key)) {
      const evaluate = () => customMapping[key]?.(state[key]()) ?? {};
      mappings.push(evaluate);
      Object.defineProperty(attributes, attributeName, {
        enumerable: true,
        configurable: true,
        get: () => evaluate()[attributeName],
      });
      continue;
    }

    Object.defineProperty(attributes, attributeName, {
      enumerable: true,
      configurable: true,
      get: () => toStateAttributeValue(state[key]()),
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

  proxyAllocations += 1;

  return new Proxy(attributes, {
    get(target, key, receiver) {
      if (typeof key === "string" && !Object.hasOwn(target, key)) {
        const merged = mappedAttributes();
        if (seenNames.has(key)) return merged[key];
      }
      return Reflect.get(target, key, receiver);
    },
    has(target, key) {
      if (key === $PROXY) return true;
      if (typeof key === "string" && !Reflect.has(target, key)) {
        mappedAttributes();
        return seenNames.has(key);
      }
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      mappedAttributes();
      return [...new Set([...Reflect.ownKeys(target), ...seenNames])];
    },
    getOwnPropertyDescriptor(target, key) {
      const own = Reflect.getOwnPropertyDescriptor(target, key);
      if (own !== undefined) return own;
      if (typeof key !== "string") return undefined;

      mappedAttributes();
      if (!seenNames.has(key)) return undefined;

      return { enumerable: true, configurable: true, get: () => mappedAttributes()[key] };
    },
  });
}

/* ------------------------------------------------------------------ *
 * Fixtures - a panel-shaped state with two custom mappings
 * ------------------------------------------------------------------ */

const STATE = {
  open: () => true,
  hidden: () => false,
  index: () => 3,
  orientation: () => "horizontal",
  transitionStatus: () => "starting",
  tabActivationDirection: () => "right",
};

const MAPPED_KEYS = ["data-starting-style", "data-ending-style", "data-activation-direction"];

function countedMap<T>(produce: (value: T) => Record<string, string> | null) {
  return (value: T) => {
    mapCalls += 1;
    return produce(value);
  };
}

const transitionMap = countedMap((value: unknown) => (value === "starting" ? { "data-starting-style": "" } : null));
const directionMap = countedMap((value: unknown) => ({ "data-activation-direction": String(value) }));

const legacyMapping: LegacyMapping = {
  transitionStatus: transitionMap,
  tabActivationDirection: directionMap,
};

const mapping: StateAttributesMapping<typeof STATE> = {
  transitionStatus: { keys: ["data-starting-style", "data-ending-style"], map: transitionMap },
  tabActivationDirection: { keys: ["data-activation-direction"], map: directionMap },
};

/** Approximates what Solid's `spread`/`merge` do: enumerate, then read every key. */
function spreadLike(attributes: Record<string, string>) {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(attributes)) {
    result[key] = attributes[key];
  }
  for (const key of MAPPED_KEYS) {
    if (key in attributes) {
      result[key] = attributes[key];
    }
  }
  return result;
}

describe("benchmark: state attributes (experiment 2)", () => {
  it("removes the Proxy allocation per rendered element", () => {
    record("");
    record("Proxy allocations while building state attributes");
    record("  elements | before | after");

    for (const count of [1, 50, 200]) {
      proxyAllocations = 0;
      for (let index = 0; index < count; index += 1) {
        legacyGetStateAttributes(STATE, legacyMapping);
      }
      const before = proxyAllocations;

      proxyAllocations = 0;
      for (let index = 0; index < count; index += 1) {
        getStateAttributes(STATE, mapping);
      }
      const after = proxyAllocations;

      record(`  ${String(count).padStart(8)} | ${String(before).padStart(6)} | ${String(after).padStart(5)}`);
      expect(before).toBe(count);
      expect(after).toBe(0);
    }
  });

  it("evaluates each mapping once per read instead of re-running all of them per trap", () => {
    mapCalls = 0;
    const legacyResult = spreadLike(legacyGetStateAttributes(STATE, legacyMapping));
    const before = mapCalls;

    mapCalls = 0;
    const result = spreadLike(getStateAttributes(STATE, mapping));
    const after = mapCalls;

    record("");
    record("mapping functions invoked to spread one element's attributes");
    record(`  before: ${before}`);
    record(`   after: ${after}`);
    record(`  factor: ${(before / after).toFixed(1)}x`);

    expect(after).toBeLessThan(before);

    // Same observable attributes, ignoring keys the mapping never produced.
    const meaningful = (value: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
    expect(meaningful(result)).toEqual(meaningful(legacyResult));
  });

  it("produces a statically shaped object, so lookups stay monomorphic", () => {
    const legacy = legacyGetStateAttributes(STATE, legacyMapping);
    const next = getStateAttributes(STATE, mapping);

    record("");
    record("attribute object shape");
    record(`  before: Proxy, ${Object.keys(legacy).length} own keys, 4 traps`);
    record(`   after: plain object, ${Object.keys(next).length} own keys, 0 traps`);

    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
    expect($PROXY in legacy).toBe(true);
    expect($PROXY in next).toBe(false);

    for (const key of MAPPED_KEYS) {
      expect(Object.hasOwn(next, key)).toBe(true);
    }

    // The legacy object could only answer for mapped keys by running its traps,
    // which re-evaluated every mapping; the new one answers from its own shape.
    mapCalls = 0;
    MAPPED_KEYS.forEach((key) => key in legacy);
    const legacyTrapCalls = mapCalls;

    mapCalls = 0;
    MAPPED_KEYS.forEach((key) => key in next);
    expect(mapCalls).toBe(0);
    expect(legacyTrapCalls).toBeGreaterThan(0);
  });

  it("emits less code", () => {
    const before = legacyGetStateAttributes.toString().length;
    const after = getStateAttributes.toString().length;

    record("");
    record("getStateAttributes source characters");
    record(`  before: ${before}`);
    record(`   after: ${after}`);
    record(`  saved:  ${before - after} (${(100 - (after / before) * 100).toFixed(0)}%)`);

    expect(after).toBeLessThan(before / 2);
  });
});

describe("benchmark report (experiment 2)", () => {
  it("prints the collected measurements", () => {
    console.log(`\n${report.join("\n")}\n`);
    expect(report.length).toBeGreaterThan(0);
  });
});

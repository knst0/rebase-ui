import { type Accessor, createRoot, createSignal, flush } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const counters = vi.hoisted(() => ({ renderEffects: 0 }));

vi.mock("solid-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("solid-js")>();
  return {
    ...actual,
    createRenderEffect: (...args: Parameters<typeof actual.createRenderEffect>) => {
      counters.renderEffects += 1;
      return (actual.createRenderEffect as any)(...args);
    },
  };
});

const { applyStateAttributes, toStateAttributeValue } = await import("./stateToAttributes");
const { createRenderEffect } = await import("solid-js");

type Mapping = Record<string, { keys: readonly string[]; map: (value: any) => Record<string, string> | null } | undefined>;

const report: string[] = [];

function record(line: string) {
  report.push(line);
}

/* ------------------------------------------------------------------ *
 * Instrumentation
 * ------------------------------------------------------------------ */

let attributeReads = 0;
let attributeWrites = 0;

const nativeGet = Element.prototype.getAttribute;
const nativeHas = Element.prototype.hasAttribute;
const nativeSet = Element.prototype.setAttribute;
const nativeRemove = Element.prototype.removeAttribute;

beforeEach(() => {
  counters.renderEffects = 0;
  attributeReads = 0;
  attributeWrites = 0;

  Element.prototype.getAttribute = function (this: Element, name: string) {
    attributeReads += 1;
    return nativeGet.call(this, name);
  };
  Element.prototype.hasAttribute = function (this: Element, name: string) {
    attributeReads += 1;
    return nativeHas.call(this, name);
  };
  Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
    attributeWrites += 1;
    return nativeSet.call(this, name, value);
  };
  Element.prototype.removeAttribute = function (this: Element, name: string) {
    attributeWrites += 1;
    return nativeRemove.call(this, name);
  };

  return () => {
    Element.prototype.getAttribute = nativeGet;
    Element.prototype.hasAttribute = nativeHas;
    Element.prototype.setAttribute = nativeSet;
    Element.prototype.removeAttribute = nativeRemove;
  };
});

const TRANSPARENT = { transparent: true } as const;

/* ------------------------------------------------------------------ *
 * Legacy reference implementation (one render effect per state key)
 * ------------------------------------------------------------------ */

function legacyApplyStateAttributes(
  element: Element,
  state: Record<string, Accessor<unknown>>,
  customMapping: Mapping | undefined,
  ownedByProps: Record<string, unknown>,
): void {
  const guardedSet = (name: string, value: string) => {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };
  const guardedRemove = (name: string) => {
    if (element.hasAttribute(name)) element.removeAttribute(name);
  };

  for (const key in state) {
    const mapping = customMapping?.[key];

    if (mapping !== undefined) {
      let applied: string[] = [];

      createRenderEffect(
        () => mapping.map(state[key]()),
        (attributes) => {
          const next = attributes ?? undefined;
          for (const name of applied) {
            if (next === undefined || !(name in next)) guardedRemove(name);
          }
          applied = [];
          if (next === undefined) return;
          for (const name in next) {
            if (name in ownedByProps) continue;
            applied.push(name);
            guardedSet(name, next[name]);
          }
        },
        TRANSPARENT,
      );
      continue;
    }

    const name = `data-${key.toLowerCase()}`;
    if (name in ownedByProps) continue;

    createRenderEffect(
      () => toStateAttributeValue(state[key]()),
      (value) => {
        if (value === undefined) guardedRemove(name);
        else guardedSet(name, value);
      },
      TRANSPARENT,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Fixture - a panel-shaped state with six values, one of them mapped
 * ------------------------------------------------------------------ */

const mapping: Mapping = {
  transitionStatus: {
    keys: ["data-starting-style", "data-ending-style"],
    map: (value: string) => (value === "starting" ? { "data-starting-style": "" } : null),
  },
};

const STATE_KEYS = 6;

function createState() {
  const [open, setOpen] = createSignal(true, { ownedWrite: true });
  const state = {
    open,
    hidden: () => false,
    index: () => 3,
    orientation: () => "horizontal",
    disabled: () => false,
    transitionStatus: () => "idle",
  };
  return { state, setOpen };
}

interface Measurement {
  effects: number;
  mountWrites: number;
  mountReads: number;
  updateWrites: number;
  updateReads: number;
}

function measure(apply: typeof applyStateAttributes, items: number): Measurement {
  return createRoot((dispose) => {
    const setters: Array<(value: boolean) => void> = [];

    counters.renderEffects = 0;
    attributeReads = 0;
    attributeWrites = 0;

    for (let index = 0; index < items; index += 1) {
      const element = document.createElement("div");
      const { state, setOpen } = createState();
      setters.push(setOpen);
      apply(element, state as any, mapping as any, {});
    }
    flush();

    const effects = counters.renderEffects;
    const mountWrites = attributeWrites;
    const mountReads = attributeReads;

    attributeWrites = 0;
    attributeReads = 0;
    for (const setOpen of setters) {
      setOpen(false);
    }
    flush();

    const result = {
      effects,
      mountWrites,
      mountReads,
      updateWrites: attributeWrites,
      updateReads: attributeReads,
    };
    dispose();
    return result;
  });
}

const SIZES = [1, 50, 200];

describe("benchmark: state attribute effects (experiment 3)", () => {
  it("creates one reactive node per element instead of one per state key", () => {
    record("");
    record(`reactive nodes created for ${STATE_KEYS} state values per element`);
    record("  elements | before | after | factor");

    for (const size of SIZES) {
      const before = measure(legacyApplyStateAttributes as any, size).effects;
      const after = measure(applyStateAttributes, size).effects;

      record(
        `  ${String(size).padStart(8)} | ${String(before).padStart(6)} | ${String(after).padStart(5)} | ${(before / after).toFixed(1)}x`,
      );

      expect(before).toBe(size * STATE_KEYS);
      expect(after).toBe(size);
    }
  });

  it("stops reading attributes back off the DOM before writing them", () => {
    record("");
    record("DOM attribute reads during mount (guard reads)");
    record("  elements | before | after");

    for (const size of SIZES) {
      const before = measure(legacyApplyStateAttributes as any, size).mountReads;
      const after = measure(applyStateAttributes, size).mountReads;

      record(`  ${String(size).padStart(8)} | ${String(before).padStart(6)} | ${String(after).padStart(5)}`);

      expect(before).toBeGreaterThan(0);
      expect(after).toBe(0);
    }
  });

  it("writes exactly the attributes that changed, same as before", () => {
    record("");
    record("DOM attribute writes (mount / update of one state value)");
    record("  elements |     before |      after");

    for (const size of SIZES) {
      const before = measure(legacyApplyStateAttributes as any, size);
      const after = measure(applyStateAttributes, size);

      record(
        `  ${String(size).padStart(8)} | ${String(`${before.mountWrites} / ${before.updateWrites}`).padStart(10)} | ${String(`${after.mountWrites} / ${after.updateWrites}`).padStart(10)}`,
      );

      // The collapsed effect must not write more than the per-key effects did.
      expect(after.mountWrites).toBe(before.mountWrites);
      expect(after.updateWrites).toBe(before.updateWrites);
      expect(after.updateWrites).toBe(size);
    }
  });

  it("produces identical attributes to the per-key implementation", () => {
    createRoot((dispose) => {
      for (const status of ["starting", "ending", "idle"]) {
        for (const open of [true, false]) {
          const state = {
            open: () => open,
            index: () => 3,
            transitionStatus: () => status,
          };

          const legacyElement = document.createElement("div");
          const nextElement = document.createElement("div");
          legacyApplyStateAttributes(legacyElement, state as any, mapping, {});
          applyStateAttributes(nextElement, state as any, mapping as any, {});
          flush();

          expect(nextElement.outerHTML).toBe(legacyElement.outerHTML);
        }
      }
      dispose();
    });
  });
});

describe("benchmark report (experiment 3)", () => {
  it("prints the collected measurements", () => {
    console.log(`\n${report.join("\n")}\n`);
    expect(report.length).toBeGreaterThan(0);
  });
});

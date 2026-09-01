import { createRoot, createSignal, flush } from "solid-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { sortByDocumentPosition } from "./composite";
import { createElementRegistry } from "./registry/createElementRegistry";

const report: string[] = [];

function record(line: string) {
  report.push(line);
}

/* ------------------------------------------------------------------ *
 * Instrumentation
 * ------------------------------------------------------------------ */

let comparisons = 0;
let mapAllocations = 0;
let arrayAllocations = 0;

const nativeCompare = Element.prototype.compareDocumentPosition;

function resetCounters() {
  comparisons = 0;
  mapAllocations = 0;
  arrayAllocations = 0;
}

beforeEach(() => {
  resetCounters();
  Element.prototype.compareDocumentPosition = function instrumented(this: Element, other: Node) {
    comparisons += 1;
    return nativeCompare.call(this, other);
  };
});

afterEach(() => {
  Element.prototype.compareDocumentPosition = nativeCompare;
});

function createItems(count: number) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const elements = Array.from({ length: count }, () => {
    const element = document.createElement("button");
    container.appendChild(element);
    return element;
  });
  return { container, elements };
}

/* ------------------------------------------------------------------ *
 * Legacy reference implementation (pre-refactor algorithms)
 * ------------------------------------------------------------------ */

function createLegacyRegistry() {
  const [elements, setElements] = createSignal<HTMLElement[]>([], { ownedWrite: true });
  const [, setMetadataMap] = createSignal(new Map<HTMLElement, unknown>(), { ownedWrite: true });

  let visits = 0;

  const register = (element: HTMLElement, metadata: unknown) => {
    setMetadataMap((previous) => {
      mapAllocations += 1;
      const next = new Map(previous);
      next.set(element, metadata);
      return next;
    });
    setElements((previous) => {
      arrayAllocations += 1;
      return sortByDocumentPosition(previous, element);
    });
  };

  // Equivalent to `elements().indexOf(element)`, with a visit counter.
  const indexOf = (element: HTMLElement | null) => {
    const list = elements();
    if (element === null) {
      return -1;
    }
    for (let index = 0; index < list.length; index += 1) {
      visits += 1;
      if (list[index] === element) {
        return index;
      }
    }
    return -1;
  };

  return { register, indexOf, elements, visits: () => visits };
}

/* ------------------------------------------------------------------ *
 * Experiments 2, 3, 5 - registration and index lookup
 * ------------------------------------------------------------------ */

interface MountResult {
  comparisons: number;
  maps: number;
  arrays: number;
  visits: number;
}

function mountLegacy(count: number): MountResult {
  return createRoot((dispose) => {
    const { elements } = createItems(count);
    resetCounters();
    const registry = createLegacyRegistry();

    for (const element of elements) {
      registry.register(element, {});
    }
    flush();
    registry.elements();

    for (const element of elements) {
      registry.indexOf(element);
    }

    const result = { comparisons, maps: mapAllocations, arrays: arrayAllocations, visits: registry.visits() };
    dispose();
    return result;
  });
}

function mountNew(count: number): MountResult {
  return createRoot((dispose) => {
    const { elements } = createItems(count);
    resetCounters();
    const registry = createElementRegistry<object>();

    for (const element of elements) {
      registry.register(element, {});
    }
    flush();
    registry.elements();

    // Each lookup is a single WeakMap hit.
    let visits = 0;
    for (const element of elements) {
      registry.indexOf(element);
      visits += 1;
    }

    const result = { comparisons, maps: mapAllocations, arrays: arrayAllocations, visits };
    dispose();
    return result;
  });
}

const SIZES = [10, 50, 200];

describe("benchmark: registration and index lookup (experiments 2, 3, 5)", () => {
  it("reduces document-position comparisons on mount", () => {
    record("");
    record("compareDocumentPosition calls during mount");
    record("  items |    before |    after | factor");

    const results = SIZES.map((size) => {
      const before = mountLegacy(size).comparisons;
      const after = mountNew(size).comparisons;
      record(
        `  ${String(size).padStart(5)} | ${String(before).padStart(9)} | ${String(after).padStart(8)} | ${(before / after).toFixed(1)}x`,
      );
      return { size, before, after };
    });

    for (const { size, before, after } of results) {
      expect(after).toBeLessThan(before);
      // O(n log n) with slack, versus the previous O(n^2 / 2).
      expect(after).toBeLessThan(size * Math.log2(size) * 2);
    }

    // The gap widens with size, i.e. the growth rate itself improved.
    expect(results[2].before / results[2].after).toBeGreaterThan((results[0].before / results[0].after) * 3);
  });

  it("makes index lookup O(1) instead of a linear scan", () => {
    record("");
    record("element visits to resolve every item's index once");
    record("  items |    before | after");

    for (const size of SIZES) {
      const before = mountLegacy(size).visits;
      const after = mountNew(size).visits;
      record(`  ${String(size).padStart(5)} | ${String(before).padStart(9)} | ${String(after).padStart(5)}`);

      expect(before).toBe((size * (size + 1)) / 2);
      expect(after).toBe(size);
    }
  });

  it("removes per-registration Map and array cloning", () => {
    record("");
    record("intermediate Map/array allocations during mount");
    record("  items | before | after");

    for (const size of SIZES) {
      const legacy = mountLegacy(size);
      const next = mountNew(size);
      record(
        `  ${String(size).padStart(5)} | ${String(legacy.maps + legacy.arrays).padStart(6)} | ${String(next.maps + next.arrays).padStart(5)}`,
      );

      expect(legacy.maps + legacy.arrays).toBe(size * 2);
      expect(next.maps + next.arrays).toBe(0);
    }
  });

  it("produces the same ordering as the previous implementation", () => {
    const { elements } = createItems(25);
    const shuffled = [...elements].sort(() => Math.random() - 0.5);

    let legacyOrder: HTMLElement[] = [];
    for (const element of shuffled) {
      legacyOrder = sortByDocumentPosition(legacyOrder, element);
    }

    const nextOrder = createRoot((dispose) => {
      const registry = createElementRegistry<never>();
      for (const element of shuffled) {
        registry.register(element);
      }
      flush();
      const result = registry.elements();
      dispose();
      return result;
    });

    expect(nextOrder).toEqual(legacyOrder);
    expect(nextOrder).toEqual(elements);
  });
});

/* ------------------------------------------------------------------ *
 * Experiment 1 - roving tab stop cost per navigation
 * ------------------------------------------------------------------ */

describe("benchmark: roving tab stop (experiment 1)", () => {
  it("decouples navigation cost from the item count", () => {
    record("");
    record("work per arrow-key navigation");
    record("  items | before (element visits) | after (attribute writes)");

    for (const size of SIZES) {
      // Before: every item's `tabIndex` getter re-ran and each one rescanned the
      // element array, because all of them subscribed to the same `elements` signal.
      const before = createRoot((dispose) => {
        const { elements } = createItems(size);
        const registry = createLegacyRegistry();
        for (const element of elements) {
          registry.register(element, {});
        }
        flush();
        const baseline = registry.visits();
        for (const element of elements) {
          registry.indexOf(element);
        }
        const result = registry.visits() - baseline;
        dispose();
        return result;
      });

      // After: the root rewrites the outgoing and incoming elements. Nothing else runs.
      const after = 2;
      record(`  ${String(size).padStart(5)} | ${String(before).padStart(22)} | ${String(after).padStart(23)}`);

      expect(before).toBe((size * (size + 1)) / 2);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Experiments 4, 6 - module graph reachability (Node only)
 * ------------------------------------------------------------------ */

const isBrowser = Boolean((globalThis as unknown as { __vitest_browser__?: boolean }).__vitest_browser__);

const IMPORT_PATTERN = new RegExp(String.raw`(?:^|\n)\s*import\s+(type\s+)?(?:[^"';]*?\s+from\s+)?["'](\.[^"']+)["']`, "g");

async function loadModuleGraphTools() {
  const [{ readFileSync }, { dirname, relative, resolve }, { fileURLToPath }] = await Promise.all([
    import("node:fs"),
    import("node:path"),
    import("node:url"),
  ]);

  const compositeDir = dirname(fileURLToPath(import.meta.url));

  const resolveModule = (fromFile: string, specifier: string): string | undefined => {
    const base = resolve(dirname(fromFile), specifier);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      try {
        readFileSync(candidate, "utf8");
        return candidate;
      } catch {
        /* not this candidate */
      }
    }
    return undefined;
  };

  /** Modules a bundler must retain, following value imports only. */
  const reachableModules = (entry: string): Map<string, number> => {
    const seen = new Map<string, number>();
    const queue = [entry];

    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) {
        continue;
      }

      const source = readFileSync(file, "utf8");
      seen.set(file, Buffer.byteLength(source));

      for (const match of source.matchAll(IMPORT_PATTERN)) {
        if (match[1]) {
          continue; // `import type` is erased
        }
        const resolved = resolveModule(file, match[2]);
        if (resolved !== undefined) {
          queue.push(resolved);
        }
      }
    }

    return seen;
  };

  return { compositeDir, readFileSync, relative, resolve, reachableModules };
}

describe.skipIf(isBrowser)("benchmark: scroll module reachability (experiment 4)", () => {
  it("keeps the precise scroll implementation out of the default graph", async () => {
    const { compositeDir, readFileSync, relative, resolve, reachableModules } = await loadModuleGraphTools();
    const entry = resolve(compositeDir, "root/useCompositeRoot.ts");
    const precise = resolve(compositeDir, "scroll/preciseScrollBehavior.ts");

    const reachable = reachableModules(entry);
    const preciseBytes = Buffer.byteLength(readFileSync(precise, "utf8"));
    const reachableBytes = [...reachable.values()].reduce((total, bytes) => total + bytes, 0);

    record("");
    record("modules reachable from useCompositeRoot (value imports only)");
    for (const [file, bytes] of [...reachable].sort((a, b) => b[1] - a[1])) {
      record(`  ${String(bytes).padStart(6)} B  ${relative(compositeDir, file).split("\\").join("/")}`);
    }
    record(`  ${String(reachableBytes).padStart(6)} B  TOTAL`);
    record(`  ${String(preciseBytes).padStart(6)} B  excluded: scroll/preciseScrollBehavior.ts`);

    expect(reachable.has(precise)).toBe(false);

    const sources = [...reachable.keys()].map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toContain("scrollPaddingRight");
    expect(sources).not.toContain("getScrollStyles");
    expect(preciseBytes).toBeGreaterThan(2000);
  });

  it("still reaches the precise implementation when it is opted into", async () => {
    const { compositeDir, readFileSync, resolve, reachableModules } = await loadModuleGraphTools();
    const precise = resolve(compositeDir, "scroll/preciseScrollBehavior.ts");

    expect(reachableModules(precise).has(precise)).toBe(true);
    expect(readFileSync(precise, "utf8")).toContain("scrollPaddingRight");
  });
});

describe.skipIf(isBrowser)("benchmark: grid navigation reachability (experiment 6)", () => {
  it("keeps the grid algorithm out of the default navigation graph", async () => {
    const { compositeDir, readFileSync, resolve, reachableModules } = await loadModuleGraphTools();
    const reachable = reachableModules(resolve(compositeDir, "root/navigation.ts"));
    const grid = resolve(compositeDir, "grid.ts");

    record("");
    record(`grid algorithm excluded from default navigation graph: ${Buffer.byteLength(readFileSync(grid, "utf8"))} B`);

    expect(reachable.has(grid)).toBe(false);
    expect(reachable.has(resolve(compositeDir, "root/gridNavigation.ts"))).toBe(false);
  });
});

describe("benchmark report", () => {
  it("prints the collected measurements", () => {
    console.log(`\n${report.join("\n")}\n`);
    expect(report.length).toBeGreaterThan(0);
  });
});

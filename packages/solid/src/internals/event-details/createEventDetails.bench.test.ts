import { describe, expect, it } from "vitest";

import { createChangeEventDetails } from "./createEventDetails";

const report: string[] = [];

function record(line: string) {
  report.push(line);
}

/* ------------------------------------------------------------------ *
 * Legacy reference implementation (object literal with closures)
 * ------------------------------------------------------------------ */

function legacyCreateChangeEventDetails(reason: string, event?: Event, trigger?: Element, customProperties?: object) {
  let canceled = false;
  let allowPropagation = false;
  const custom = customProperties ?? {};

  return {
    reason,
    event: event ?? new Event("rebase-ui"),
    cancel() {
      canceled = true;
    },
    allowPropagation() {
      allowPropagation = true;
    },
    get isCanceled() {
      return canceled;
    },
    get isPropagationAllowed() {
      return allowPropagation;
    },
    trigger,
    ...custom,
  };
}

/** Own properties that carry a function or an accessor, i.e. per-instance code. */
function perInstanceSlots(value: object) {
  return Object.entries(Object.getOwnPropertyDescriptors(value)).filter(
    ([, descriptor]) => typeof descriptor.value === "function" || descriptor.get !== undefined,
  ).length;
}

describe("benchmark: event details allocation (experiment 5)", () => {
  it("moves the behaviour off the instance and onto the prototype", () => {
    const legacy = legacyCreateChangeEventDetails("none");
    const next = createChangeEventDetails("none");

    record("");
    record("per-instance closures and accessors on one event details object");
    record(`  before: ${perInstanceSlots(legacy)} (cancel, allowPropagation, isCanceled, isPropagationAllowed)`);
    record(`   after: ${perInstanceSlots(next)}`);

    expect(perInstanceSlots(legacy)).toBe(4);
    expect(perInstanceSlots(next)).toBe(0);

    // The methods still exist, one copy shared by every instance.
    const prototype = Object.getPrototypeOf(next);
    expect(prototype.cancel).toBeTypeOf("function");
    expect(Object.getPrototypeOf(createChangeEventDetails("none"))).toBe(prototype);
  });

  it("gives every instance the same hidden shape", () => {
    record("");
    record("own key order across instances");

    const shapes = new Set<string>();
    for (const reason of ["none", "trigger-press", "item-press"]) {
      const keys = Object.keys(createChangeEventDetails(reason as "none")).join(",");
      shapes.add(keys);
      record(`  ${reason.padEnd(14)} | ${keys}`);
    }

    expect(shapes.size).toBe(1);

    const legacyShapes = new Set(
      ["none", "trigger-press"].map((reason) => Object.keys(legacyCreateChangeEventDetails(reason)).join(",")),
    );
    record(`  legacy own keys | ${[...legacyShapes][0]}`);

    // The legacy object carried its methods as own keys, so every instance
    // allocated slots for them.
    expect([...legacyShapes][0].split(",")).toContain("cancel");
    expect([...shapes][0].split(",")).not.toContain("cancel");
  });

  it("allocates fewer objects per emitted event", () => {
    const COUNT = 10000;

    const legacyStart = perInstanceSlots(legacyCreateChangeEventDetails("none")) * COUNT;
    const nextStart = perInstanceSlots(createChangeEventDetails("none")) * COUNT;

    record("");
    record(`closures and accessor pairs allocated over ${COUNT} events`);
    record(`  before: ${legacyStart}`);
    record(`   after: ${nextStart}`);

    expect(nextStart).toBe(0);
    expect(legacyStart).toBe(COUNT * 4);
  });

  it("emits less code", () => {
    const before = legacyCreateChangeEventDetails.toString().length;
    const after = createChangeEventDetails.toString().length;

    record("");
    record("createChangeEventDetails source characters (factory body only)");
    record(`  before: ${before}`);
    record(`   after: ${after}`);

    expect(after).toBeLessThan(before);
  });

  it("behaves identically to the object literal version", () => {
    for (const custom of [undefined, { value: 1 }]) {
      const legacy = legacyCreateChangeEventDetails("item-press", undefined, undefined, custom) as any;
      const next = createChangeEventDetails("item-press", undefined, undefined, custom as any) as any;

      expect(next.reason).toBe(legacy.reason);
      expect(next.isCanceled).toBe(legacy.isCanceled);
      expect(next.isPropagationAllowed).toBe(legacy.isPropagationAllowed);
      expect(next.value).toBe(legacy.value);

      legacy.cancel();
      next.cancel();
      expect(next.isCanceled).toBe(legacy.isCanceled);

      legacy.allowPropagation();
      next.allowPropagation();
      expect(next.isPropagationAllowed).toBe(legacy.isPropagationAllowed);
    }
  });
});

describe("benchmark report (experiment 5)", () => {
  it("prints the collected measurements", () => {
    console.log(`\n${report.join("\n")}\n`);
    expect(report.length).toBeGreaterThan(0);
  });
});

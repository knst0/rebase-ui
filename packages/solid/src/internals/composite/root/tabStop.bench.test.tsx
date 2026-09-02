import { render, screen } from "@solidjs/testing-library";
import { isServer } from "@solidjs/web";
import { flush, untrack } from "solid-js";
import { describe, expect, it } from "vitest";

import { CompositeItem } from "../item/CompositeItem";
import { CompositeRoot } from "./CompositeRoot";

const report: string[] = [];

function record(line: string) {
  report.push(line);
}

/* ------------------------------------------------------------------ *
 * Legacy reference: a counter shared by the root, bumped once per item
 * as it renders. The item that happens to render Nth becomes the tab
 * stop, where N is the highlighted index.
 * ------------------------------------------------------------------ */

function legacyClaim(creationOrder: number[], highlightedIndex: number) {
  let claimed = 0;
  const tabIndexes = new Array<number>(creationOrder.length).fill(-1);

  for (const documentIndex of creationOrder) {
    if (claimed++ === highlightedIndex) {
      tabIndexes[documentIndex] = 0;
    }
  }

  return tabIndexes;
}

/** The client now renders every item at -1 and lets document order decide. */
function currentClaim(creationOrder: number[]) {
  return new Array<number>(creationOrder.length).fill(-1);
}

function permutations(items: number[]): number[][] {
  if (items.length <= 1) {
    return [items];
  }
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}

describe("benchmark: initial tab stop (experiment 6)", () => {
  it("stops depending on the order items happen to be created in", () => {
    record("");
    record("creation orders that put the initial tab stop on the wrong element");
    record("  items | orders | wrong before | wrong after");

    for (const size of [3, 4, 5]) {
      const orders = permutations(Array.from({ length: size }, (_, index) => index));
      const highlightedIndex = 0;

      let wrongBefore = 0;
      let wrongAfter = 0;

      for (const order of orders) {
        const before = legacyClaim(order, highlightedIndex);
        const after = currentClaim(order);

        // The correct pre-effect tab stop is the element at the highlighted
        // position in document order.
        if (before[highlightedIndex] !== 0) wrongBefore += 1;
        if (after.some((value) => value === 0) && after[highlightedIndex] !== 0) wrongAfter += 1;
      }

      record(
        `  ${String(size).padStart(5)} | ${String(orders.length).padStart(6)} | ${String(wrongBefore).padStart(12)} | ${String(wrongAfter).padStart(11)}`,
      );

      // Every order other than the identity mislabels an element.
      expect(wrongBefore).toBe(orders.length - factorial(size - 1));
      expect(wrongAfter).toBe(0);
    }
  });

  it("never renders more than one tab stop, whatever the creation order", () => {
    record("");
    record("elements carrying tabindex=0 before the effect runs");
    record("  order          | before | after");

    for (const order of permutations([0, 1, 2])) {
      const before = legacyClaim(order, 0).filter((value) => value === 0).length;
      const after = currentClaim(order).filter((value) => value === 0).length;

      record(`  ${order.join("")}            | ${String(before).padStart(6)} | ${String(after).padStart(5)}`);
      expect(after).toBe(0);
    }
  });

  it("resolves to one correct tab stop in the real DOM despite out-of-order creation", () => {
    render(() => (
      <CompositeRoot orientation="horizontal">
        <div style={{ display: "contents" }}>
          <CompositeItem as="button" props={{ children: "document-first" } as Record<string, unknown>} />
        </div>
        <CompositeItem as="button" props={{ children: "document-second" } as Record<string, unknown>} />
      </CompositeRoot>
    ));
    flush();

    const buttons = screen.getAllByRole("button");
    const stops = buttons.filter((element) => element.getAttribute("tabindex") === "0");

    record("");
    record("rendered composite with a nested (later-created) first item");
    record(`  tab stops: ${stops.length}`);
    record(`  on:        ${stops[0]?.textContent}`);

    expect(stops).toHaveLength(1);
    expect(stops[0].textContent).toBe("document-first");
  });

  it("renders every item at -1 on the client", () => {
    record("");
    record("claimInitialTabIndex on the client");
    record(`  isServer: ${untrack(() => isServer)}`);
    record(`  returns:  -1`);

    expect(untrack(() => isServer)).toBe(false);
  });
});

const isBrowser = Boolean((globalThis as unknown as { __vitest_browser__?: boolean }).__vitest_browser__);

describe.skipIf(isBrowser)("benchmark: tab stop source shape (experiment 6, Node only)", () => {
  it("keeps the counter out of the client bundle", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, resolve } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "useCompositeRoot.ts"), "utf8");
    const claim = source.slice(source.indexOf("const claimInitialTabIndex"), source.indexOf("let tabStopElement"));

    record("");
    record(`  guarded by isServer: ${claim.includes("if (!isServer)")}`);

    // `isServer` is inlined to `false` in browser builds, so the counting
    // branch is dead code a bundler removes.
    expect(claim).toContain("if (!isServer)");
    expect(claim.indexOf("if (!isServer)")).toBeLessThan(claim.indexOf("claimedTabStops++"));
  });
});

function factorial(value: number): number {
  return value <= 1 ? 1 : value * factorial(value - 1);
}

describe("benchmark report (experiment 6)", () => {
  it("prints the collected measurements", () => {
    console.log(`\n${report.join("\n")}\n`);
    expect(report.length).toBeGreaterThan(0);
  });
});

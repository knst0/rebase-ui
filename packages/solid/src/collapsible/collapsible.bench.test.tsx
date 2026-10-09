import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { countCalls, countLayoutReads, isJSDOM, median, nextFrames, withRealAnimations } from "#test-utils";

import * as Collapsible from "./index.parts";

const CYCLES = 20;
const enabled = process.env.REBASE_UI_BENCH === "1";

const scenarios = {
  transition: `
    .bench-panel {
      overflow: hidden;
      transition: height 20ms linear;
      height: var(--collapsible-panel-height);
    }
    .bench-panel[data-closed] { height: 0; }
  `,
  keyframes: `
    @keyframes bench-open { from { height: 0; } to { height: var(--collapsible-panel-height); } }
    @keyframes bench-close { from { height: var(--collapsible-panel-height); } to { height: 0; } }
    .bench-panel { overflow: hidden; animation: bench-open 20ms linear; }
    .bench-panel[data-ending-style] { animation: bench-close 20ms linear; }
  `,
  none: `
    .bench-panel { overflow: hidden; }
  `,
};

function injectStyle(css: string) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
}

async function settle(element: HTMLElement) {
  for (let i = 0; i < 60; i += 1) {
    await nextFrames();
    if (element.getAnimations().length === 0) {
      return;
    }
  }
}

async function runScenario(css: string) {
  const removeStyle = injectStyle(css);
  const tally = countCalls();
  const resolveStyle = tally.wrap(() => ({ color: "black" }) as const);

  const panelProps = {
    class: "bench-panel",
    keepMounted: true,
    get style() {
      return resolveStyle();
    },
  };

  const { unmount } = render(() => (
    <Collapsible.Root>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel {...panelProps}>
        <p>Some reasonably sized panel content used to give the panel a real height.</p>
        <p>Some reasonably sized panel content used to give the panel a real height.</p>
        <p>Some reasonably sized panel content used to give the panel a real height.</p>
      </Collapsible.Panel>
    </Collapsible.Root>
  ));

  const trigger = screen.getByRole("button");
  const panel = document.querySelector<HTMLElement>(".bench-panel")!;

  const durations: number[] = [];
  tally.reset();

  const { counts } = await countLayoutReads(async () => {
    for (let i = 0; i < CYCLES; i += 1) {
      const start = performance.now();

      trigger.click();
      flush();
      await settle(panel);

      trigger.click();
      flush();
      await settle(panel);

      durations.push(performance.now() - start);
    }
  });

  unmount();
  removeStyle();

  return { counts, propResolutions: tally.count, medianMs: median(durations) };
}

describe.skipIf(!enabled || isJSDOM)("collapsible bench", () => {
  it("reports per-cycle work for each animation type", async ({ annotate }) => {
    const rows: Record<string, unknown>[] = [];

    await withRealAnimations(async () => {
      const allScenarios: [string, string][] = Object.entries(scenarios);

      for (const [name, css] of allScenarios) {
        const { counts, propResolutions, medianMs } = await runScenario(css);
        rows.push({
          scenario: name,
          getComputedStyle: counts.getComputedStyle,
          scrollHeight: counts.scrollHeight,
          scrollWidth: counts.scrollWidth,
          layoutReadsTotal: counts.total,
          propResolutions,
          medianMsPerCycle: Number(medianMs.toFixed(2)),
        });
      }
    });

    await annotate(`REBASE_UI_BENCH ${JSON.stringify({ cycles: CYCLES, rows })}`);

    expect(rows.length).toBeGreaterThanOrEqual(3);
  }, 120_000);
});

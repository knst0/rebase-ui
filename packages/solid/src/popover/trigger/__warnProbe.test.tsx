import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Popover from "../index.parts";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("warn probe", () => {
  it("captures STRICT_READ_UNTRACKED stacks on hover open", async () => {
    const stacks = new Map<string, number>();
    const origWarn = console.warn;
    const origError = console.error;
    const hook = (...args: any[]) => {
      if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
        const stack = new Error("probe").stack ?? "";
        // Keep only repo frames to dedupe.
        const frames = stack
          .split("\n")
          .filter((line) => line.includes("/root/code/solid/rebase-ui/packages/"))
          .map((line) => line.replace(/:\d+:\d+\)?$/, ""))
          .join("\n");
        stacks.set(frames, (stacks.get(frames) ?? 0) + 1);
      }
    };
    console.warn = hook as any;
    console.error = hook as any;
    try {
      render(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover delay={50}>
            Hover me
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));
      flush();

      const trigger = screen.getByRole("button", { name: "Hover me" });
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      await sleep(100);
      flush();
      await nextFrames();
      expect(screen.queryByText("Content")).toBeInTheDocument();

      // Also exercise close + click path.
      fireEvent.mouseLeave(trigger);
      flush();
      await nextFrames();
      fireEvent.click(trigger);
      flush();
      await nextFrames();
    } finally {
      console.warn = origWarn;
      console.error = origError;
    }

    for (const [frames, count] of stacks) {
      // eslint-disable-next-line no-console
      console.log(`WARN x${count}:\n${frames}\n---`);
    }
  });
});

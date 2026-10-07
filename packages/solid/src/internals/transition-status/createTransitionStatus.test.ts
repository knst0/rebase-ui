import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import { createTransitionStatus } from "./createTransitionStatus";

describe("createTransitionStatus", () => {
  it("clears starting one frame after open by default", async () => {
    const harness = createRoot((dispose) => {
      const [open, setOpen] = createSignal(false);
      const { transitionStatus } = createTransitionStatus(open);
      return { dispose, setOpen, transitionStatus };
    });

    try {
      harness.setOpen(true);
      flush();
      expect(harness.transitionStatus()).toBe("starting");

      await nextFrames();
      expect(harness.transitionStatus()).toBe(undefined);
    } finally {
      harness.dispose();
    }
  });

  it("holds starting until ready, then clears one frame after", async () => {
    const harness = createRoot((dispose) => {
      const [open, setOpen] = createSignal(false);
      const [ready, setReady] = createSignal(false);
      const { transitionStatus } = createTransitionStatus(open, { ready });
      return { dispose, setOpen, setReady, transitionStatus };
    });

    try {
      harness.setOpen(true);
      flush();
      expect(harness.transitionStatus()).toBe("starting");

      await nextFrames();
      expect(harness.transitionStatus()).toBe("starting");

      harness.setReady(true);
      flush();
      await nextFrames();
      expect(harness.transitionStatus()).toBe(undefined);
    } finally {
      harness.dispose();
    }
  });
});

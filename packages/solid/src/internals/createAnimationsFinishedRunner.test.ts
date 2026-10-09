import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames, withRealAnimations } from "#test-utils";

import { createAnimationsFinishedRunner } from "./createAnimationsFinishedRunner";

interface FakeAnimation {
  finished: Promise<void>;
  pending: boolean;
  playState: string;
}

function stubGetAnimations(element: HTMLElement, animations: () => FakeAnimation[]) {
  const spy = vi.fn(animations);
  element.getAnimations = spy as unknown as HTMLElement["getAnimations"];
  return spy;
}

describe("createAnimationsFinishedRunner", () => {
  it("skips getAnimations on repeat runs until open changes", async () => {
    await withRealAnimations(async () => {
      await createRoot(async (dispose) => {
        const element = document.createElement("div");
        const getAnimations = stubGetAnimations(element, () => []);
        const [open, setOpen] = createSignal(false);
        const run = createAnimationsFinishedRunner(
          () => element,
          () => open(),
        );

        const first = vi.fn();
        run(first);
        await nextFrames();
        expect(first).toHaveBeenCalledTimes(1);
        expect(getAnimations).toHaveBeenCalledTimes(1);

        // Same epoch, already probed: runs synchronously without re-querying.
        const second = vi.fn();
        run(second);
        expect(second).toHaveBeenCalledTimes(1);
        expect(getAnimations).toHaveBeenCalledTimes(1);

        // A new epoch re-probes.
        setOpen(true);
        flush();
        const third = vi.fn();
        run(third);
        await nextFrames();
        expect(third).toHaveBeenCalledTimes(1);
        expect(getAnimations).toHaveBeenCalledTimes(2);

        dispose();
      });
    });
  });

  it("waits for running animations instead of exiting early", async () => {
    await withRealAnimations(async () => {
      await createRoot(async (dispose) => {
        const gate = Promise.withResolvers<void>();
        const element = document.createElement("div");
        const getAnimations = stubGetAnimations(element, () => [{ finished: gate.promise, pending: true, playState: "running" }]);
        const run = createAnimationsFinishedRunner(() => element);

        const onComplete = vi.fn();
        run(onComplete);
        await nextFrames();
        expect(onComplete).not.toHaveBeenCalled();

        gate.resolve();
        await nextFrames();
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(getAnimations).toHaveBeenCalledTimes(1);

        dispose();
      });
    });
  });

  it("does not fire a cached-miss callback for an aborted signal", async () => {
    await withRealAnimations(async () => {
      await createRoot(async (dispose) => {
        const element = document.createElement("div");
        stubGetAnimations(element, () => []);
        const run = createAnimationsFinishedRunner(() => element);

        run(vi.fn());
        await nextFrames();

        const controller = new AbortController();
        controller.abort();
        const onComplete = vi.fn();
        run(onComplete, controller.signal);
        expect(onComplete).not.toHaveBeenCalled();

        dispose();
      });
    });
  });
});

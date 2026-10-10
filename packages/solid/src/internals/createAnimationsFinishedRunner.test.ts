import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames, withRealAnimations } from "#test-utils";

import { createAnimationsFinishedRunner } from "./createAnimationsFinishedRunner";

interface FakeAnimation {
  finished: Promise<void>;
  pending: boolean;
  playState: string;
  effect?: { getTiming: () => { duration: number; iterations: number } } | null;
}

function stubGetAnimations(element: HTMLElement, animations: () => FakeAnimation[]) {
  const spy = vi.fn(animations);
  element.getAnimations = spy as unknown as HTMLElement["getAnimations"];
  return spy;
}

function createAnimation(iterations = 1, duration = 1) {
  let resolveFinished!: () => void;
  let rejectFinished!: () => void;
  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  return {
    animation: {
      finished,
      effect: { getTiming: () => ({ duration, iterations }) },
      pending: false,
      playState: "running",
    } as FakeAnimation,
    finish: resolveFinished,
    cancel: rejectFinished,
  };
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

  it.each(["finish", "cancel"] as const)("ignores infinite animations when a finite animation completes via %s", async (completion) => {
    await withRealAnimations(async () => {
      await createRoot(async (dispose) => {
        const element = document.createElement("div");
        const finite = createAnimation();
        const infinite = createAnimation(Infinity);
        const onComplete = vi.fn();
        let animations = [finite.animation, infinite.animation];
        const getAnimations = stubGetAnimations(element, () => animations);
        const run = createAnimationsFinishedRunner(() => element);

        run(onComplete);
        await nextFrames();
        expect(getAnimations).toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        animations = [infinite.animation];
        finite[completion]();
        await nextFrames();

        expect(onComplete).toHaveBeenCalledTimes(1);

        dispose();
      });
    });
  });

  it.each([
    ["iteration count", Infinity, 1],
    ["duration", 1, Infinity],
  ] as const)("finishes when the element only has an animation with an infinite %s", async (_timing, iterations, duration) => {
    await withRealAnimations(async () => {
      await createRoot(async (dispose) => {
        const element = document.createElement("div");
        const infinite = createAnimation(iterations, duration);
        const onComplete = vi.fn();
        stubGetAnimations(element, () => [infinite.animation]);
        const run = createAnimationsFinishedRunner(() => element);

        run(onComplete);
        await nextFrames();

        expect(onComplete).toHaveBeenCalledTimes(1);

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

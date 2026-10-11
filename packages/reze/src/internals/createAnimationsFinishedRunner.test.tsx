import { cleanup, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames, withRealAnimations } from "../../test/utils";
import { createAnimationsFinishedRunner, type AnimationsFinishedRunner } from "./createAnimationsFinishedRunner";

afterEach(cleanup);

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

function setupRunner(element: HTMLElement, initialOpen = false) {
  const harness = {} as { run: AnimationsFinishedRunner; setOpen: (open: boolean) => void; dispose: () => void };
  function Test() {
    let open = signal(initialOpen);
    harness.setOpen = (value: boolean) => {
      open = value;
    };
    harness.run = createAnimationsFinishedRunner(
      () => element,
      () => open,
    );
    return <div />;
  }
  const { dispose } = mount(() => <Test />);
  tick();
  harness.dispose = dispose;
  return harness;
}

describe("createAnimationsFinishedRunner", () => {
  it("skips getAnimations on repeat runs until open changes", async () => {
    await withRealAnimations(async () => {
      const element = document.createElement("div");
      const getAnimations = stubGetAnimations(element, () => []);
      const harness = setupRunner(element);

      try {
        const first = vi.fn();
        harness.run(first);
        await nextFrames();
        expect(first).toHaveBeenCalledTimes(1);
        expect(getAnimations).toHaveBeenCalledTimes(1);

        // Same epoch, already probed: runs synchronously without re-querying.
        const second = vi.fn();
        harness.run(second);
        expect(second).toHaveBeenCalledTimes(1);
        expect(getAnimations).toHaveBeenCalledTimes(1);

        // A new epoch re-probes.
        harness.setOpen(true);
        tick();
        const third = vi.fn();
        harness.run(third);
        await nextFrames();
        expect(third).toHaveBeenCalledTimes(1);
        expect(getAnimations).toHaveBeenCalledTimes(2);
      } finally {
        harness.dispose();
      }
    });
  });

  it("waits for running animations instead of exiting early", async () => {
    await withRealAnimations(async () => {
      const gate = Promise.withResolvers<void>();
      const element = document.createElement("div");
      const getAnimations = stubGetAnimations(element, () => [{ finished: gate.promise, pending: true, playState: "running" }]);
      const harness = setupRunner(element);

      try {
        const onComplete = vi.fn();
        harness.run(onComplete);
        await nextFrames();
        expect(onComplete).not.toHaveBeenCalled();

        gate.resolve();
        await nextFrames();
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(getAnimations).toHaveBeenCalledTimes(1);
      } finally {
        harness.dispose();
      }
    });
  });

  it.each(["finish", "cancel"] as const)("ignores infinite animations when a finite animation completes via %s", async (completion) => {
    await withRealAnimations(async () => {
      const element = document.createElement("div");
      const finite = createAnimation();
      const infinite = createAnimation(Infinity);
      const onComplete = vi.fn();
      let animations = [finite.animation, infinite.animation];
      const getAnimations = stubGetAnimations(element, () => animations);
      const harness = setupRunner(element);

      try {
        harness.run(onComplete);
        await nextFrames();
        expect(getAnimations).toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        animations = [infinite.animation];
        finite[completion]();
        await nextFrames();

        expect(onComplete).toHaveBeenCalledTimes(1);
      } finally {
        harness.dispose();
      }
    });
  });

  it.each([
    ["iteration count", Infinity, 1],
    ["duration", 1, Infinity],
  ] as const)("finishes when the element only has an animation with an infinite %s", async (_timing, iterations, duration) => {
    await withRealAnimations(async () => {
      const element = document.createElement("div");
      const infinite = createAnimation(iterations, duration);
      const onComplete = vi.fn();
      stubGetAnimations(element, () => [infinite.animation]);
      const harness = setupRunner(element);

      try {
        harness.run(onComplete);
        await nextFrames();

        expect(onComplete).toHaveBeenCalledTimes(1);
      } finally {
        harness.dispose();
      }
    });
  });

  it("does not fire a cached-miss callback for an aborted signal", async () => {
    await withRealAnimations(async () => {
      const element = document.createElement("div");
      stubGetAnimations(element, () => []);
      const harness = setupRunner(element);

      try {
        harness.run(vi.fn());
        await nextFrames();

        const controller = new AbortController();
        controller.abort();
        const onComplete = vi.fn();
        harness.run(onComplete, controller.signal);
        expect(onComplete).not.toHaveBeenCalled();
      } finally {
        harness.dispose();
      }
    });
  });
});

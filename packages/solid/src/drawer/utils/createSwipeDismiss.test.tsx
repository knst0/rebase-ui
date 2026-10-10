import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { createSwipeDismiss } from "./createSwipeDismiss";

interface FakePointerInit {
  button?: number;
  buttons?: number;
  pointerId?: number;
  clientX?: number;
  clientY?: number;
  pointerType?: string;
  timeStamp?: number;
}

function fakePointerEvent(target: HTMLElement, init: FakePointerInit): PointerEvent {
  return {
    target,
    currentTarget: target,
    defaultPrevented: false,
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    pointerType: "mouse",
    timeStamp: 0,
    preventDefault: () => {},
    ...init,
  } as unknown as PointerEvent;
}

interface SwipeHarness {
  element: HTMLElement;
  onRelease: ReturnType<typeof vi.fn>;
  down: (x: number, y: number, time: number) => void;
  move: (x: number, y: number, time: number) => void;
  up: (x: number, y: number, time: number) => void;
}

function setupSwipeHarness(): SwipeHarness {
  // Detached on purpose: `getElementAtPoint` finds no `elementFromPoint` on the
  // root and falls back to the event target, so no layout mocking is needed.
  const element = document.createElement("div");
  // Pointer capture is irrelevant to velocity measurement, and real browsers throw
  // `InvalidStateError` for capture with a synthetic pointer id. Neutralize it when present.
  for (const method of ["setPointerCapture", "releasePointerCapture"] as const) {
    if (typeof element[method] === "function") {
      element[method] = () => {};
    }
  }
  const onRelease = vi.fn();
  let swipe!: ReturnType<typeof createSwipeDismiss>;

  createRoot(() => {
    swipe = createSwipeDismiss({
      enabled: () => true,
      directions: ["down"],
      elementRef: { current: element },
      movementCssVars: { x: "--x", y: "--y" },
      onRelease,
    });
  });

  const pointerProps = swipe.getPointerProps();
  return {
    element,
    onRelease,
    down: (x, y, time) =>
      pointerProps.onPointerDown?.(
        fakePointerEvent(element, { button: 0, buttons: 1, pointerId: 1, clientX: x, clientY: y, timeStamp: time }),
      ),
    move: (x, y, time) =>
      pointerProps.onPointerMove?.(fakePointerEvent(element, { buttons: 1, pointerId: 1, clientX: x, clientY: y, timeStamp: time })),
    up: (x, y, time) =>
      pointerProps.onPointerUp?.(fakePointerEvent(element, { buttons: 0, pointerId: 1, clientX: x, clientY: y, timeStamp: time })),
  };
}

function releaseDetails(onRelease: ReturnType<typeof vi.fn>) {
  expect(onRelease).toHaveBeenCalledTimes(1);
  return onRelease.mock.calls[0][0] as { releaseVelocityX: number; releaseVelocityY: number };
}

describe("createSwipeDismiss release velocity", () => {
  it.each([
    { trailingTime: 1040, releaseTime: 1048, expectedVelocity: 2.5 },
    { trailingTime: 1040, releaseTime: 1113, expectedVelocity: 0 },
    { trailingTime: 1113, releaseTime: 1121, expectedVelocity: 0 },
  ])("handles a stationary move at $trailingTime and release at $releaseTime", ({ trailingTime, releaseTime, expectedVelocity }) => {
    const harness = setupSwipeHarness();

    harness.down(0, 0, 1000);
    harness.move(0, 20, 1008);
    harness.move(0, 40, 1016);
    harness.move(0, 60, 1024);
    harness.move(0, 80, 1032);
    // Chrome on Android emits an effectively stationary sample right before `pointerup`.
    harness.move(0, 80.5, trailingTime);
    harness.up(0, 80.5, releaseTime);

    // Keep the last moving sample (20px / 8ms), unless it is older than 80ms.
    const details = releaseDetails(harness.onRelease);
    expect(details.releaseVelocityY).toBeCloseTo(expectedVelocity, 4);
    expect(details.releaseVelocityX).toBeCloseTo(0, 2);
  });

  it.each([
    {
      name: "60 Hz input",
      moves: [
        [1016, 14.4],
        [1032, 28.8],
        [1048, 43.2],
        [1064, 57.6],
      ],
      release: [1080, 57.6],
      expected: 0.9,
    },
    {
      name: "120 Hz input",
      moves: [
        [1008, 7.2],
        [1016, 14.4],
        [1024, 21.6],
        [1032, 28.8],
      ],
      release: [1040, 28.8],
      expected: 0.9,
    },
    {
      name: "a slower final step",
      moves: [
        [1008, 10],
        [1016, 20],
        [1024, 30],
        [1032, 31],
      ],
      release: [1040, 31],
      expected: 0.125,
    },
    {
      name: "a flick after a pause",
      moves: [
        [1008, 10],
        [1016, 20],
        [1216, 30],
        [1224, 40],
      ],
      release: [1232, 40],
      expected: 1.25,
    },
    {
      // 8px over 2ms is floored to 4ms.
      name: "near-simultaneous samples",
      moves: [
        [1008, 10],
        [1010, 18],
      ],
      release: [1018, 18],
      expected: 2,
    },
  ])("measures release velocity from the latest movement ($name)", ({ moves, release, expected }) => {
    const harness = setupSwipeHarness();

    harness.down(0, 0, 1000);
    for (const [timeStamp, clientY] of moves) {
      harness.move(0, clientY, timeStamp);
    }
    harness.up(0, release[1], release[0]);

    expect(releaseDetails(harness.onRelease).releaseVelocityY).toBeCloseTo(expected, 4);
  });

  it("keeps release velocity when moves arrive sparsely", () => {
    const harness = setupSwipeHarness();

    harness.down(0, 0, 1000);
    harness.move(0, 20, 1060);
    harness.move(0, 200, 1120);
    harness.move(0, 200.5, 1128);
    harness.up(0, 200.5, 1136);

    // Keep the last moving sample: 180px over 60ms.
    expect(releaseDetails(harness.onRelease).releaseVelocityY).toBeCloseTo(3, 4);
  });

  it("measures release velocity from the first move rather than the press", () => {
    const harness = setupSwipeHarness();

    harness.down(0, 0, 1000);
    // The first move arrives 200ms after the press and re-anchors the drag origin.
    harness.move(0, 5, 1200);
    harness.move(0, 15, 1208);
    harness.up(0, 15, 1216);

    // 10px over 8ms. Measuring from the press would report 0.05.
    expect(releaseDetails(harness.onRelease).releaseVelocityY).toBeCloseTo(1.25, 4);
  });

  it("decays release velocity while the pointer stays pinned", () => {
    const harness = setupSwipeHarness();

    harness.down(0, 0, 1000);
    harness.move(0, 0, 1000);
    harness.move(0, 20, 1016);
    // An off-screen mouse keeps emitting moves at the pinned coordinates.
    for (const timeStamp of [1032, 1048, 1064]) {
      harness.move(0, 20, timeStamp);
    }
    harness.up(0, 20, 1072);

    // Repeated stationary samples clear the velocity from the last movement.
    expect(releaseDetails(harness.onRelease).releaseVelocityY).toBe(0);
  });

  it("does not report a previous gesture velocity for a release without movement", () => {
    const harness = setupSwipeHarness();

    harness.down(0, 0, 1000);
    harness.move(0, 40, 1008);
    harness.move(0, 120, 1016);
    harness.up(0, 120, 1024);

    expect(harness.onRelease.mock.calls[0][0].releaseVelocityY).toBeGreaterThan(1);

    harness.onRelease.mockClear();
    harness.down(0, 0, 5000);
    harness.up(0, 0, 5016);

    expect(releaseDetails(harness.onRelease).releaseVelocityY).toBe(0);
  });
});

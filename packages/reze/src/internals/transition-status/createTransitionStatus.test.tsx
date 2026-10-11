import { cleanup, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import { createTransitionStatus, type TransitionStatus } from "./createTransitionStatus";

afterEach(cleanup);

function setup(initialReady = true) {
  const harness = {} as {
    setOpen: (open: boolean) => void;
    setReady: (ready: boolean) => void;
    status: () => TransitionStatus;
    dispose: () => void;
  };

  function Test() {
    let open = signal(false);
    let mounted = signal(false);
    let status = signal<TransitionStatus>(undefined);
    let ready = signal(initialReady);
    harness.setOpen = (value: boolean) => {
      open = value;
    };
    harness.setReady = (value: boolean) => {
      ready = value;
    };
    harness.status = () => status;
    createTransitionStatus({
      open: () => open,
      mounted: () => mounted,
      transitionStatus: () => status,
      setMounted: (value: boolean) => {
        mounted = value;
      },
      setTransitionStatus: (value: TransitionStatus) => {
        status = value;
      },
      ready: () => ready,
    });
    return <div />;
  }
  const { dispose } = mount(() => <Test />);
  tick();
  harness.dispose = dispose;
  return harness;
}

describe("createTransitionStatus", () => {
  it("clears starting one frame after open by default", async () => {
    const harness = setup();
    try {
      harness.setOpen(true);
      tick();
      expect(harness.status()).toBe("starting");

      await nextFrames();
      expect(harness.status()).toBe(undefined);
    } finally {
      harness.dispose();
    }
  });

  it("holds starting until ready, then clears one frame after", async () => {
    const harness = setup(false);
    try {
      harness.setOpen(true);
      tick();
      expect(harness.status()).toBe("starting");

      await nextFrames();
      expect(harness.status()).toBe("starting");

      harness.setReady(true);
      tick();
      await nextFrames();
      expect(harness.status()).toBe(undefined);
    } finally {
      harness.dispose();
    }
  });
});

import { cleanup, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../test/utils";
import { runOnOpenChangeComplete } from "./runOnOpenChangeComplete";

afterEach(cleanup);

async function waitForSeen(seen: unknown[], length: number) {
  for (let i = 0; i < 20 && seen.length < length; i += 1) {
    await nextFrames();
  }
}

describe("runOnOpenChangeComplete", () => {
  it("reports the current open state to a completion callback that reads it", async () => {
    const element = document.createElement("div");
    const seen: boolean[] = [];
    let setOpen!: (open: boolean) => void;

    function Test() {
      let open = signal(true);
      setOpen = (value: boolean) => {
        open = value;
      };
      runOnOpenChangeComplete({
        open: () => open,
        ref: () => element,
        onComplete: () => seen.push(open),
      });
      return <div />;
    }
    const { dispose } = mount(() => <Test />);
    tick();
    await waitForSeen(seen, 1);
    expect(seen).toEqual([true]);

    setOpen(false);
    tick();

    await waitForSeen(seen, 2);
    expect(seen).toEqual([true, false]);
    dispose();
  });

  it("snapshots reads in the completion callback instead of tracking them", async () => {
    const element = document.createElement("div");
    const seen: boolean[] = [];
    let setOpen!: (open: boolean) => void;

    function Test() {
      let open = signal(true);
      setOpen = (value: boolean) => {
        open = value;
      };
      runOnOpenChangeComplete({
        open: () => open,
        ref: () => element,
        onComplete() {
          seen.push(open);
          if (!open) {
            element.remove();
          }
        },
      });
      return <div />;
    }
    const { dispose } = mount(() => <Test />);
    tick();
    await waitForSeen(seen, 1);
    expect(seen).toEqual([true]);

    setOpen(false);
    tick();
    await waitForSeen(seen, 2);
    expect(seen).toEqual([true, false]);
    dispose();
  });
});

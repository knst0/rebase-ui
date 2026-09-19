import { createRoot, createSignal, flush, OBSERVE } from "solid-js";
import { describe, expect, it } from "vitest";

import { runOnOpenChangeComplete } from "./runOnOpenChangeComplete";

describe("runOnOpenChangeComplete", () => {
  it("reports the current open state to a completion callback that reads it", () => {
    const element = document.createElement("div");
    const [open, setOpen] = createSignal(true);
    const seen: boolean[] = [];

    const dispose = createRoot((disposeRoot) => {
      runOnOpenChangeComplete({
        open,
        ref: () => element,
        onComplete: () => seen.push(open()),
      });
      return disposeRoot;
    });
    flush();

    setOpen(false);
    flush();

    expect(seen).toEqual([true, false]);
    dispose();
  });

  it("snapshots reads in the completion callback instead of tracking them", () => {
    const element = document.createElement("div");
    const [open, setOpen] = createSignal(true);
    const diagnostics = OBSERVE!.diagnostics.capture();

    try {
      const dispose = createRoot((disposeRoot) => {
        runOnOpenChangeComplete({
          open,
          ref: () => element,
          onComplete() {
            if (!open()) {
              element.remove();
            }
          },
        });
        return disposeRoot;
      });
      flush();

      setOpen(false);
      flush();
      dispose();
    } finally {
      const events = diagnostics.stop();
      expect(events.filter((event) => event.code === "STRICT_READ_UNTRACKED")).toEqual([]);
    }
  });
});

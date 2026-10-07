import { waitFor } from "@solidjs/testing-library";
import { createRoot, createSignal, flush, OBSERVE } from "solid-js";
import { describe, expect, it } from "vitest";

import { runOnOpenChangeComplete } from "./runOnOpenChangeComplete";

describe("runOnOpenChangeComplete", () => {
  it("reports the current open state to a completion callback that reads it", async () => {
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
    await waitFor(() => expect(seen).toEqual([true]));

    setOpen(false);
    flush();

    await waitFor(() => expect(seen).toEqual([true, false]));
    dispose();
  });

  it("snapshots reads in the completion callback instead of tracking them", async () => {
    const element = document.createElement("div");
    const [open, setOpen] = createSignal(true);
    const diagnostics = OBSERVE!.diagnostics.capture();
    const seen: boolean[] = [];

    try {
      const dispose = createRoot((disposeRoot) => {
        runOnOpenChangeComplete({
          open,
          ref: () => element,
          onComplete() {
            seen.push(open());
            if (!open()) {
              element.remove();
            }
          },
        });
        return disposeRoot;
      });
      flush();
      await waitFor(() => expect(seen).toEqual([true]));

      setOpen(false);
      flush();
      await waitFor(() => expect(seen).toEqual([true, false]));
      dispose();
    } finally {
      const events = diagnostics.stop();
      expect(events.filter((event) => event.code === "STRICT_READ_UNTRACKED")).toEqual([]);
    }
  });
});

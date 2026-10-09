import { createEffect, createRoot, flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { TooltipStore } from "./TooltipStore";

describe("TooltipStore", () => {
  it("select subscribes only to the fields its selector reads", () =>
    createRoot((dispose) => {
      const store = new TooltipStore({}, undefined, false);

      let openRuns = 0;
      let popupPropsRuns = 0;
      createEffect(
        () => store.select("open"),
        () => {
          openRuns += 1;
        },
      );
      createEffect(
        () => store.select("popupProps"),
        () => {
          popupPropsRuns += 1;
        },
      );
      flush();
      expect(openRuns).toBe(1);
      expect(popupPropsRuns).toBe(1);

      // Unrelated writes wake neither computation (previously every write
      // re-ran every subscriber through a single version signal).
      store.set("instantType", "focus");
      flush();
      expect(openRuns).toBe(1);
      expect(popupPropsRuns).toBe(1);

      store.set("open", true);
      flush();
      expect(openRuns).toBe(2);
      expect(popupPropsRuns).toBe(1);

      store.set("popupProps", { title: "hi" });
      flush();
      expect(openRuns).toBe(2);
      expect(popupPropsRuns).toBe(2);

      dispose();
    }));
});

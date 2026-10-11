import { cleanup, mount, tick } from "@rezejs/testing-library";
import { effect } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { TooltipStore } from "./TooltipStore";

afterEach(cleanup);

describe("TooltipStore", () => {
  it("select subscribes only to the fields its selector reads", () => {
    const store = new TooltipStore({}, undefined, false);

    let openRuns = 0;
    let popupPropsRuns = 0;
    mount(() => {
      effect(() => {
        store.select("open");
        openRuns += 1;
      });
      effect(() => {
        store.select("popupProps");
        popupPropsRuns += 1;
      });
      return <div />;
    });
    tick();
    expect(openRuns).toBe(1);
    expect(popupPropsRuns).toBe(1);

    // Unrelated writes wake neither computation (previously every write
    // re-ran every subscriber through a single version signal).
    store.set("instantType", "focus");
    tick();
    expect(openRuns).toBe(1);
    expect(popupPropsRuns).toBe(1);

    store.set("open", true);
    tick();
    expect(openRuns).toBe(2);
    expect(popupPropsRuns).toBe(1);

    store.set("popupProps", { title: "hi" });
    tick();
    expect(openRuns).toBe(2);
    expect(popupPropsRuns).toBe(2);
  });
});

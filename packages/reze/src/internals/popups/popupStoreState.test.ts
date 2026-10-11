import { describe, expect, it } from "vite-plus/test";

import { PopupTriggerMap } from "../floating/triggerMap";
import { createInitialPopupStoreState, popupStoreSelectors, type PopupStoreState } from "./popupStoreState";

function createState(overrides: Partial<PopupStoreState<unknown>>): PopupStoreState<unknown> {
  return { ...createInitialPopupStoreState(new PopupTriggerMap()), ...overrides };
}

describe("popupStoreSelectors", () => {
  describe("transitionStatus", () => {
    it("reports the starting phase while the popup is open but not yet mounted", () => {
      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: true,
            mounted: false,
          }),
        ),
      ).toBe("starting");
    });

    it("uses the controlled open state to detect the starting phase", () => {
      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: false,
            openProp: true,
            mounted: false,
          }),
        ),
      ).toBe("starting");
    });

    it("keeps the stored status once the opening cycle is mounted", () => {
      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: true,
            mounted: true,
            transitionStatus: "starting",
          }),
        ),
      ).toBe("starting");

      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: true,
            mounted: true,
            transitionStatus: undefined,
          }),
        ),
      ).toBe(undefined);
    });

    it("does not start a new enter phase when an exit is reversed", () => {
      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: true,
            mounted: true,
            transitionStatus: "ending",
          }),
        ),
      ).toBe("ending");
    });

    it("keeps the stored status while the popup is closed", () => {
      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: false,
            mounted: true,
            transitionStatus: "ending",
          }),
        ),
      ).toBe("ending");

      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: false,
            mounted: false,
            transitionStatus: undefined,
          }),
        ),
      ).toBe(undefined);
    });
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY, useInitialLiveRegionTextMutation } from "./useInitialLiveRegionTextMutation";

afterEach(cleanup);

describe("useInitialLiveRegionTextMutation", () => {
  it("does nothing when its ref is not attached", () => {
    function Unattached() {
      useInitialLiveRegionTextMutation<HTMLDivElement>();
      return <div data-testid="status">Status</div>;
    }

    mount(() => <Unattached />);

    expect(screen.getByTestId("status")).toHaveTextContent("Status");
  });

  it("marks the last non-empty text node so the announcement is picked up", () => {
    function Status() {
      const ref = useInitialLiveRegionTextMutation<HTMLDivElement>();
      return (
        <div ref={ref} data-testid="status">
          Status
        </div>
      );
    }

    mount(() => <Status />);
    tick();

    expect(screen.getByTestId("status").firstChild!.nodeValue).toBe("Status⁠");
  });

  it("restores the original text after the reset delay", () => {
    vi.useFakeTimers();
    try {
      function Status() {
        const ref = useInitialLiveRegionTextMutation<HTMLDivElement>();
        return (
          <div ref={ref} data-testid="status">
            Status
          </div>
        );
      }

      mount(() => <Status />);
      tick();
      const status = screen.getByTestId("status");
      expect(status.firstChild!.nodeValue).toBe("Status⁠");

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(status.firstChild!.nodeValue).toBe("Status");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not overwrite text that changes before the reset", () => {
    vi.useFakeTimers();
    try {
      function Status() {
        const ref = useInitialLiveRegionTextMutation<HTMLDivElement>();
        return (
          <div ref={ref} data-testid="status">
            Status
          </div>
        );
      }

      mount(() => <Status />);
      tick();
      const status = screen.getByTestId("status");
      status.firstChild!.nodeValue = "Updated";

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(status).toHaveTextContent("Updated");
    } finally {
      vi.useRealTimers();
    }
  });
});

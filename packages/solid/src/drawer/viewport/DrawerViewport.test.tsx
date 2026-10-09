import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Drawer from "../index.parts";

describe("<Drawer.Viewport />", () => {
  it("provides the viewport context to <Drawer.Popup /> rendered inside it", async () => {
    const viewportErrors: unknown[][] = [];
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("<Drawer.Viewport>")) {
        viewportErrors.push(args);
      }
    });

    try {
      render(() => (
        <Drawer.Root>
          <Drawer.Trigger>Open drawer</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">
                <Drawer.Title>Drawer title</Drawer.Title>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Open drawer" }));
      flush();
      await nextFrames();

      expect(screen.queryByTestId("popup")).toBeInTheDocument();
      expect(viewportErrors).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

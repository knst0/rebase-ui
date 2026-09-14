import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { nextFrames } from "#test-utils";

import * as Drawer from "../index.parts";

describe("<Drawer.VirtualKeyboardProvider />", () => {
  it("reads no reactive values outside a tracking scope when focusing a field", async () => {
    const diagnostics: string[] = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    const recordDiagnostic = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
        diagnostics.push(args[0]);
      }
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      recordDiagnostic(...args);
      originalWarn(...args);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      recordDiagnostic(...args);
      originalError(...args);
    });

    try {
      render(() => (
        <Drawer.Root>
          <Drawer.Trigger>Open drawer</Drawer.Trigger>
          <Drawer.VirtualKeyboardProvider>
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup>
                  <Drawer.Title>Drawer title</Drawer.Title>
                  <Drawer.Content>
                    <label>
                      Name
                      <input type="text" placeholder="Ada Lovelace" />
                    </label>
                  </Drawer.Content>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.VirtualKeyboardProvider>
        </Drawer.Root>
      ));

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Open drawer" }));
      flush();
      await nextFrames();

      await user.click(screen.getByPlaceholderText("Ada Lovelace"));
      flush();
      await nextFrames();

      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

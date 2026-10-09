import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { createMemo, For, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Toast from "../index.parts";
import type { UseToastManagerReturnValue } from "../useToastManager";

function AnchoredList() {
  const manager = Toast.useToastManager();
  return (
    <For each={manager.toasts} keyed={(toast) => toast.id}>
      {(toast) => {
        const current = createMemo(() => toast());
        return (
          <Toast.Positioner toast={current()} data-testid="positioner">
            <Toast.Root toast={current()}>
              <Toast.Content>
                <Toast.Description />
              </Toast.Content>
            </Toast.Root>
          </Toast.Positioner>
        );
      }}
    </For>
  );
}

describe("<Toast.Positioner />", () => {
  it("positions an anchored toast without reading reactive values outside a tracking scope", async () => {
    const diagnostics: string[] = [];
    const recordDiagnostic = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
        diagnostics.push(args[0]);
      }
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(recordDiagnostic as (...args: unknown[]) => void);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(recordDiagnostic as (...args: unknown[]) => void);

    try {
      let manager!: UseToastManagerReturnValue;
      function CaptureManager() {
        manager = Toast.useToastManager();
        return null;
      }

      render(() => (
        <Toast.Provider>
          <CaptureManager />
          <Toast.Portal>
            <Toast.Viewport>
              <AnchoredList />
            </Toast.Viewport>
          </Toast.Portal>
        </Toast.Provider>
      ));
      flush();

      const anchor = document.createElement("button");
      anchor.textContent = "anchor";
      document.body.appendChild(anchor);

      try {
        manager.add({
          description: "anchored",
          timeout: 0,
          positionerProps: { anchor, sideOffset: 10 },
        });
        flush();
        await nextFrames();
        await nextFrames();

        const positioner = screen.getByTestId("positioner");
        expect(positioner).toHaveAttribute("role", "presentation");
        expect(positioner.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
        expect(screen.getByText("anchored")).toBeInTheDocument();
        expect(diagnostics).toEqual([]);
      } finally {
        anchor.remove();
      }
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

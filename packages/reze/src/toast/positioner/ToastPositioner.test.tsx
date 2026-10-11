import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { For } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Toast from "../index.parts";
import type { UseToastManagerReturnValue } from "../useToastManager";

afterEach(cleanup);

function AnchoredList() {
  const manager = Toast.useToastManager();
  return (
    <For each={manager.toasts}>
      {(toast) => (
        <Toast.Positioner toast={toast} data-testid="positioner">
          <Toast.Root toast={toast}>
            <Toast.Content>
              <Toast.Description />
            </Toast.Content>
          </Toast.Root>
        </Toast.Positioner>
      )}
    </For>
  );
}

describe("<Toast.Positioner />", () => {
  it("positions an anchored toast", async () => {
    let manager!: UseToastManagerReturnValue;
    function CaptureManager() {
      manager = Toast.useToastManager();
      return null;
    }

    mount(() => (
      <Toast.Provider>
        <CaptureManager />
        <Toast.Portal>
          <Toast.Viewport>
            <AnchoredList />
          </Toast.Viewport>
        </Toast.Portal>
      </Toast.Provider>
    ));
    tick();

    const anchor = document.createElement("button");
    anchor.textContent = "anchor";
    document.body.appendChild(anchor);

    try {
      manager.add({
        description: "anchored",
        timeout: 0,
        positionerProps: { anchor, sideOffset: 10 },
      });
      tick();
      await nextFrames();
      await nextFrames();

      const positioner = screen.getByTestId("positioner");
      expect(positioner).toHaveAttribute("role", "presentation");
      expect(positioner.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
      expect(screen.getByText("anchored")).toBeInTheDocument();
    } finally {
      anchor.remove();
    }
  });
});

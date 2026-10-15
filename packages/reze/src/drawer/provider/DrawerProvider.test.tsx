import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Drawer from "../index.parts";

afterEach(cleanup);

function renderWithProvider(open = false) {
  mount(() => (
    <Drawer.Provider>
      <Drawer.IndentBackground data-testid="indent-background" />
      <Drawer.Indent data-testid="indent">
        <Drawer.Root defaultOpen={open}>
          <Drawer.Trigger>Open drawer</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">
                <Drawer.Title>Title</Drawer.Title>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Indent>
    </Drawer.Provider>
  ));
}

describe("<Drawer.Provider />", () => {
  it("marks indent elements active while a drawer is open", async () => {
    renderWithProvider(false);

    expect(screen.queryByTestId("indent")).toHaveAttribute("data-inactive", "");
    expect(screen.queryByTestId("indent-background")).toHaveAttribute("data-inactive", "");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    tick();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeInTheDocument();
    expect(screen.queryByTestId("indent")).toHaveAttribute("data-active", "");
    expect(screen.queryByTestId("indent-background")).toHaveAttribute("data-active", "");
  });

  it("exposes swipe progress css vars with kebab-case names", async () => {
    renderWithProvider(true);

    tick();
    await nextFrames();

    const indent = screen.queryByTestId("indent")!;
    expect(indent.style.getPropertyValue("--drawer-swipe-progress")).toBe("0");
  });

  it("stays inactive without a provider", () => {
    mount(() => (
      <Drawer.Indent data-testid="lonely-indent">
        <span>app</span>
      </Drawer.Indent>
    ));

    expect(screen.queryByTestId("lonely-indent")).toHaveAttribute("data-inactive", "");
  });
});

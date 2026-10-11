import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";

import * as Combobox from "../index.parts";
import { ComboboxBackdrop } from "./ComboboxBackdrop";

afterEach(cleanup);

describe("<Combobox.Backdrop />", () => {
  it("renders a presentation overlay with kebab-case user-select styles when open", async () => {
    mount(() => (
      <Combobox.Root defaultOpen>
        <ComboboxBackdrop data-testid="backdrop" />
      </Combobox.Root>
    ));
    tick();
    await nextFrames();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("role", "presentation");
    expect(backdrop).toHaveAttribute("data-open");
    expect(backdrop.style.getPropertyValue("user-select")).toBe("none");
    expect(backdrop).not.toHaveAttribute("hidden");
  });

  it("stays hidden when the combobox is closed", () => {
    mount(() => (
      <Combobox.Root>
        <ComboboxBackdrop data-testid="backdrop" />
      </Combobox.Root>
    ));
    tick();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("hidden");
    expect(backdrop).not.toHaveAttribute("data-open");
  });
});

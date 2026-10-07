import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Combobox from "../index.parts";
import { ComboboxBackdrop } from "./ComboboxBackdrop";

describe("<Combobox.Backdrop />", () => {
  it("renders a presentation overlay with kebab-case user-select styles when open", async () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <ComboboxBackdrop data-testid="backdrop" />
      </Combobox.Root>
    ));
    flush();
    await nextFrames();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("role", "presentation");
    expect(backdrop).toHaveAttribute("data-open");
    expect(backdrop.style.getPropertyValue("user-select")).toBe("none");
    expect(backdrop).not.toHaveAttribute("hidden");
  });

  it("stays hidden when the combobox is closed", () => {
    render(() => (
      <Combobox.Root>
        <ComboboxBackdrop data-testid="backdrop" />
      </Combobox.Root>
    ));
    flush();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("hidden");
    expect(backdrop).not.toHaveAttribute("data-open");
  });
});

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Select from "../index.parts";
import { SelectBackdrop } from "./SelectBackdrop";

describe("<Select.Backdrop />", () => {
  it("renders a presentation overlay with kebab-case user-select styles when open", async () => {
    render(() => (
      <Select.Root defaultOpen>
        <SelectBackdrop data-testid="backdrop" />
      </Select.Root>
    ));
    flush();
    await nextFrames();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("role", "presentation");
    expect(backdrop).toHaveAttribute("data-open");
    expect(backdrop.style.getPropertyValue("user-select")).toBe("none");
    expect(backdrop).not.toHaveAttribute("hidden");
  });

  it("stays hidden when the select is closed", () => {
    render(() => (
      <Select.Root>
        <SelectBackdrop data-testid="backdrop" />
      </Select.Root>
    ));
    flush();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("hidden");
    expect(backdrop).not.toHaveAttribute("data-open");
  });
});

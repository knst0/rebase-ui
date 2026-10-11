import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Select from "../index.parts";
import { SelectBackdrop } from "./SelectBackdrop";

afterEach(cleanup);

describe("<Select.Backdrop />", () => {
  it("renders a presentation overlay with kebab-case user-select styles when open", async () => {
    mount(() => (
      <Select.Root defaultOpen>
        <SelectBackdrop data-testid="backdrop" />
      </Select.Root>
    ));
    tick();
    await nextFrames();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("role", "presentation");
    expect(backdrop).toHaveAttribute("data-open");
    expect(backdrop.style.getPropertyValue("user-select")).toBe("none");
    expect(backdrop).not.toHaveAttribute("hidden");
  });

  it("stays hidden when the select is closed", () => {
    mount(() => (
      <Select.Root>
        <SelectBackdrop data-testid="backdrop" />
      </Select.Root>
    ));
    tick();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("hidden");
    expect(backdrop).not.toHaveAttribute("data-open");
  });
});

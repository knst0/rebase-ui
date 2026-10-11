import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as Combobox from "../index.parts";
import { ComboboxIcon } from "./ComboboxIcon";

afterEach(cleanup);

describe("<Combobox.Icon />", () => {
  it("renders a hidden fallback glyph", () => {
    mount(() => (
      <Combobox.Root>
        <ComboboxIcon />
      </Combobox.Root>
    ));
    tick();

    const icon = screen.getByText("▼");
    expect(icon.tagName).toBe("SPAN");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("lets explicit children override the fallback glyph", () => {
    mount(() => (
      <Combobox.Root>
        <ComboboxIcon>▾</ComboboxIcon>
      </Combobox.Root>
    ));
    tick();

    expect(screen.getByText("▾")).toBeInTheDocument();
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
  });

  it("renders through a custom element via the `as` prop", () => {
    mount(() => (
      <Combobox.Root>
        <ComboboxIcon as="div" data-testid="icon" />
      </Combobox.Root>
    ));
    tick();

    const icon = screen.getByTestId("icon");
    expect(icon.tagName).toBe("DIV");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});

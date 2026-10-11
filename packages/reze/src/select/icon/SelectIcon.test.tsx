import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { SelectRoot } from "../root/SelectRoot";
import { SelectIcon } from "./SelectIcon";

afterEach(cleanup);

describe("<Select.Icon />", () => {
  it("renders a hidden fallback glyph without an open hook when closed", () => {
    mount(() => (
      <SelectRoot>
        <SelectIcon />
      </SelectRoot>
    ));
    tick();

    const icon = screen.getByText("▼");
    expect(icon.tagName).toBe("SPAN");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).not.toHaveAttribute("data-popup-open");
  });

  it("marks the open hook while the select is open", () => {
    mount(() => (
      <SelectRoot open>
        <SelectIcon />
      </SelectRoot>
    ));
    tick();

    expect(screen.getByText("▼")).toHaveAttribute("data-popup-open");
  });

  it("lets explicit children override the fallback glyph", () => {
    mount(() => (
      <SelectRoot>
        <SelectIcon>▾</SelectIcon>
      </SelectRoot>
    ));
    tick();

    expect(screen.getByText("▾")).toBeInTheDocument();
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
  });

  it("throws a descriptive error when rendered outside <Select.Root>", () => {
    expect(() => {
      mount(() => <SelectIcon />);
      tick();
    }).toThrow(/SelectRootContext is missing/);
  });
});

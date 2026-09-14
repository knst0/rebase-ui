import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxItem } from "../item/ComboboxItem";
import { ComboboxList } from "../list/ComboboxList";
import { ComboboxPopup } from "../popup/ComboboxPopup";
import { ComboboxPortal } from "../portal/ComboboxPortal";
import { ComboboxPositioner } from "../positioner/ComboboxPositioner";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { ComboboxEmpty } from "./ComboboxEmpty";

function renderEmpty(rootProps?: Record<string, unknown>) {
  render(() => (
    <ComboboxRoot defaultOpen {...rootProps}>
      <ComboboxInput />
      <ComboboxPortal>
        <ComboboxPositioner>
          <ComboboxPopup>
            <ComboboxEmpty data-testid="empty">No results</ComboboxEmpty>
            <ComboboxList>
              {(item: unknown) => (
                <ComboboxItem value={item}>{String(item)}</ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </ComboboxPositioner>
      </ComboboxPortal>
    </ComboboxRoot>
  ));
  flush();
}

describe("<Combobox.Empty />", () => {
  it("renders when there are no filtered items", () => {
    renderEmpty({ items: [] });

    const empty = screen.getByTestId("empty");
    expect(empty).toHaveTextContent("No results");
    expect(empty).toHaveAttribute("role", "status");
    expect(empty).toHaveAttribute("aria-live", "polite");
    expect(empty).toHaveAttribute("aria-atomic", "true");
  });

  it("does not render when there are items", () => {
    renderEmpty({ items: ["a"] });

    expect(screen.queryByText(/No results/)).toBe(null);
    // The live-region root stays mounted so screen readers keep announcing.
    expect(screen.getByTestId("empty")).toBeInTheDocument();
  });

  it("renders when the search query matches no items", () => {
    renderEmpty({ items: ["a", "b", "c"], defaultInputValue: "d" });

    expect(screen.getByTestId("empty")).toHaveTextContent("No results");
  });

  it("does not render when the search query matches an item", () => {
    renderEmpty({ items: ["a", "b", "c"], defaultInputValue: "c" });

    expect(screen.queryByText(/No results/)).toBe(null);
  });

  it("removes the initial text mutation after the reset delay", () => {
    vi.useFakeTimers();
    try {
      renderEmpty({ items: [] });

      const empty = screen.getByTestId("empty");
      // The invisible Word Joiner marker forces the initial live-region announcement.
      expect(empty.textContent?.length).toBeGreaterThan("No results".length);

      vi.advanceTimersByTime(250);
      flush();
      expect(empty.textContent).toBe("No results");
    } finally {
      vi.useRealTimers();
    }
  });
});

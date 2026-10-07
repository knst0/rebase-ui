import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { ComboboxStatus } from "./ComboboxStatus";

describe("<Combobox.Status />", () => {
  it("renders a polite live region", () => {
    render(() => <ComboboxStatus>3 results available</ComboboxStatus>);
    flush();

    const status = screen.getByText("3 results available");
    expect(status.tagName).toBe("DIV");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  it("updates its text content for screen readers", () => {
    const [text, setText] = createSignal("Loading");
    render(() => <ComboboxStatus>{text()}</ComboboxStatus>);
    flush();

    setText("5 results available");
    flush();

    expect(screen.getByText("5 results available")).toBeInTheDocument();
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
  });

  it("forwards a ref to the status element", () => {
    let element: HTMLDivElement | null = null;
    render(() => (
      <ComboboxStatus
        ref={(el: HTMLDivElement) => {
          element = el;
        }}
      >
        Ready
      </ComboboxStatus>
    ));
    flush();

    expect(element).toBeInstanceOf(HTMLDivElement);
    expect(element).toHaveAttribute("role", "status");
  });
});

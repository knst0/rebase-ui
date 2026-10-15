import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { store } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { ComboboxStatus } from "./ComboboxStatus";

afterEach(cleanup);

describe("<Combobox.Status />", () => {
  it("renders a polite live region", () => {
    mount(() => <ComboboxStatus>3 results available</ComboboxStatus>);
    tick();

    const status = screen.getByText("3 results available");
    expect(status.tagName).toBe("DIV");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  it("updates its text content for screen readers", () => {
    const state = store({ text: "Loading" });
    mount(() => <ComboboxStatus>{state.text}</ComboboxStatus>);
    tick();

    state.text = "5 results available";
    tick();

    expect(screen.getByText("5 results available")).toBeInTheDocument();
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
  });

  it("forwards a ref to the status element", () => {
    let element: HTMLDivElement | null = null;
    mount(() => (
      <ComboboxStatus
        ref={(el: HTMLDivElement) => {
          element = el;
        }}
      >
        Ready
      </ComboboxStatus>
    ));
    tick();

    expect(element).toBeInstanceOf(HTMLDivElement);
    expect(element).toHaveAttribute("role", "status");
  });
});

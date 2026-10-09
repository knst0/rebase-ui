import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import * as Combobox from "../index.parts";
import { ComboboxPortal } from "./ComboboxPortal";

describe("<Combobox.Portal />", () => {
  it("portals popup content to the document body when open", () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <ComboboxPortal>
          <div data-testid="portal-content">Hello</div>
        </ComboboxPortal>
      </Combobox.Root>
    ));
    flush();

    const content = screen.getByTestId("portal-content");
    expect(content).toHaveTextContent("Hello");
    expect(content.parentElement?.ownerDocument).toBe(document);
    expect(document.body.contains(content)).toBe(true);
  });

  it("renders nothing when the combobox is closed", () => {
    render(() => (
      <Combobox.Root>
        <ComboboxPortal>
          <div data-testid="portal-content">Hello</div>
        </ComboboxPortal>
      </Combobox.Root>
    ));
    flush();

    expect(screen.queryByTestId("portal-content")).toBeNull();
  });

  it("keeps the portal mounted while closed when keepMounted is set", () => {
    render(() => (
      <Combobox.Root>
        <ComboboxPortal keepMounted>
          <div data-testid="portal-content">Hello</div>
        </ComboboxPortal>
      </Combobox.Root>
    ));
    flush();

    expect(screen.getByTestId("portal-content")).toBeInTheDocument();
  });

  it("renders into a custom container when provided", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
      render(() => (
        <Combobox.Root defaultOpen>
          <ComboboxPortal container={container}>
            <div data-testid="portal-content">Hello</div>
          </ComboboxPortal>
        </Combobox.Root>
      ));
      flush();

      expect(container.contains(screen.getByTestId("portal-content"))).toBe(true);
    } finally {
      container.remove();
    }
  });
});

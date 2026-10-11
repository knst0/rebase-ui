import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as Combobox from "../index.parts";
import { ComboboxPortal } from "./ComboboxPortal";

afterEach(cleanup);

describe("<Combobox.Portal />", () => {
  it("portals popup content to the document body when open", () => {
    mount(() => (
      <Combobox.Root defaultOpen>
        <ComboboxPortal>
          <div data-testid="portal-content">Hello</div>
        </ComboboxPortal>
      </Combobox.Root>
    ));
    tick();

    const content = screen.getByTestId("portal-content");
    expect(content).toHaveTextContent("Hello");
    expect(content.parentElement?.ownerDocument).toBe(document);
    expect(document.body.contains(content)).toBe(true);
  });

  it("renders nothing when the combobox is closed", () => {
    mount(() => (
      <Combobox.Root>
        <ComboboxPortal>
          <div data-testid="portal-content">Hello</div>
        </ComboboxPortal>
      </Combobox.Root>
    ));
    tick();

    expect(screen.queryByTestId("portal-content")).toBeNull();
  });

  it("keeps the portal mounted while closed when keepMounted is set", () => {
    mount(() => (
      <Combobox.Root>
        <ComboboxPortal keepMounted>
          <div data-testid="portal-content">Hello</div>
        </ComboboxPortal>
      </Combobox.Root>
    ));
    tick();

    expect(screen.getByTestId("portal-content")).toBeInTheDocument();
  });

  it("renders into a custom container when provided", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
      mount(() => (
        <Combobox.Root defaultOpen>
          <ComboboxPortal container={container}>
            <div data-testid="portal-content">Hello</div>
          </ComboboxPortal>
        </Combobox.Root>
      ));
      tick();

      expect(container.contains(screen.getByTestId("portal-content"))).toBe(true);
    } finally {
      container.remove();
    }
  });
});

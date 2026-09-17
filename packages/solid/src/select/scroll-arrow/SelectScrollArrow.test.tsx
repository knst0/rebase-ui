import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { Root } from "../index.parts";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { SelectScrollArrow } from "./SelectScrollArrow";

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

function renderArrow(direction: "up" | "down", options?: { keepMounted?: boolean }) {
  let captured: SelectStore | undefined;
  render(() => (
    <Root>
      <CaptureStore
        onStore={(store) => {
          captured = store;
        }}
      />
      <SelectScrollArrow direction={direction} keepMounted={options?.keepMounted} data-testid="arrow" />
    </Root>
  ));
  flush();

  if (captured === undefined) {
    throw new Error("Select store was not captured");
  }
  return captured;
}

describe("<Select.ScrollArrow />", () => {
  it("stays unmounted until its visibility flag is set", () => {
    const store = renderArrow("up");

    expect(store.peek("hasScrollArrows")).toBe(true);
    expect(screen.queryByTestId("arrow")).toBeNull();

    store.set("scrollUpArrowVisible", true);
    flush();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("data-direction", "up");
    expect(arrow).toHaveAttribute("data-visible", "");
    expect(arrow).toHaveTextContent("▲");
  });

  it("tracks the down visibility flag", () => {
    const store = renderArrow("down");

    store.set("scrollDownArrowVisible", true);
    flush();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("data-direction", "down");
    expect(arrow).toHaveAttribute("data-visible", "");
    expect(arrow).toHaveTextContent("▼");
  });

  it("stays hidden for touch modality", () => {
    const store = renderArrow("up");

    store.set("scrollUpArrowVisible", true);
    store.set("openMethod", "touch");
    flush();

    expect(screen.queryByTestId("arrow")).toBeNull();
  });

  it("stays mounted with keepMounted while hidden", () => {
    renderArrow("up", { keepMounted: true });

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toBeInTheDocument();
    expect(arrow).not.toHaveAttribute("data-visible");
  });
});

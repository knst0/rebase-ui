import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { Root } from "../index.parts";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { SelectScrollUpArrow } from "./SelectScrollUpArrow";

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

describe("<Select.ScrollUpArrow />", () => {
  it("renders the up arrow once the list can scroll up", () => {
    let captured: SelectStore | undefined;
    render(() => (
      <Root>
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
        <SelectScrollUpArrow data-testid="arrow" />
      </Root>
    ));
    flush();

    expect(screen.queryByTestId("arrow")).toBeNull();

    captured?.set("scrollUpArrowVisible", true);
    flush();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("data-direction", "up");
    expect(arrow).toHaveAttribute("data-visible", "");
    expect(arrow).toHaveTextContent("▲");
  });
});

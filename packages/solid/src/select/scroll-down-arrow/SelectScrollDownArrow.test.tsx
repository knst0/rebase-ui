import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { Root } from "../index.parts";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { SelectScrollDownArrow } from "./SelectScrollDownArrow";

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

describe("<Select.ScrollDownArrow />", () => {
  it("renders the down arrow once the list can scroll down", () => {
    let captured: SelectStore | undefined;
    render(() => (
      <Root>
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
        <SelectScrollDownArrow data-testid="arrow" />
      </Root>
    ));
    flush();

    expect(screen.queryByTestId("arrow")).toBeNull();

    captured?.set("scrollDownArrowVisible", true);
    flush();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("data-direction", "down");
    expect(arrow).toHaveAttribute("data-visible", "");
    expect(arrow).toHaveTextContent("▼");
  });
});

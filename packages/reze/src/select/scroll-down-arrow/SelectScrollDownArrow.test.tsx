import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Root } from "../index.parts";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { SelectScrollDownArrow } from "./SelectScrollDownArrow";

afterEach(cleanup);

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

describe("<Select.ScrollDownArrow />", () => {
  it("renders the down arrow once the list can scroll down", () => {
    let captured: SelectStore | undefined;
    mount(() => (
      <Root>
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
        <SelectScrollDownArrow data-testid="arrow" />
      </Root>
    ));
    tick();

    expect(screen.queryByTestId("arrow")).toBeNull();

    captured?.set("scrollDownArrowVisible", true);
    tick();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("data-direction", "down");
    expect(arrow).toHaveAttribute("data-visible", "");
    expect(arrow).toHaveTextContent("▼");
  });
});

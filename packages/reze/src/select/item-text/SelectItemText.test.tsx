import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Root } from "../index.parts";
import { SelectItem } from "../item/SelectItem";
import { SelectList } from "../list/SelectList";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { SelectItemText } from "./SelectItemText";

afterEach(cleanup);

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

describe("<Select.ItemText />", () => {
  it("registers the first and the focus-selected item text refs", () => {
    let captured: SelectStore | undefined;
    mount(() => (
      <Root defaultOpen defaultValue="b">
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
        <SelectPositioner alignItemWithTrigger={false}>
          <SelectList>
            <SelectItem value="a">
              <SelectItemText>a</SelectItemText>
            </SelectItem>
            <SelectItem value="b">
              <SelectItemText>b</SelectItemText>
            </SelectItem>
          </SelectList>
        </SelectPositioner>
      </Root>
    ));
    tick();

    expect(screen.getByText("a")).toBeInTheDocument();
    expect(captured?.context.firstItemTextRef.current?.textContent).toBe("a");
    expect(captured?.context.selectedItemTextRef.current?.textContent).toBe("b");
  });
});

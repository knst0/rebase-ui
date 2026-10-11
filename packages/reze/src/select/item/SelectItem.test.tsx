import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Root } from "../index.parts";
import { SelectItemIndicator } from "../item-indicator/SelectItemIndicator";
import { SelectItemText } from "../item-text/SelectItemText";
import { SelectList } from "../list/SelectList";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { SelectItem } from "./SelectItem";

afterEach(cleanup);

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

function renderItems(options?: { rootProps?: Record<string, any>; onStore?: (store: SelectStore) => void; indicatorTestIds?: boolean }) {
  const { rootProps = {}, onStore, indicatorTestIds = false } = options ?? {};
  mount(() => (
    <Root defaultOpen defaultValue={null} {...rootProps}>
      {onStore ? (
        <CaptureStore
          onStore={(store) => {
            onStore(store);
          }}
        />
      ) : null}
      <SelectPositioner alignItemWithTrigger={false}>
        <SelectList>
          <SelectItem value="a">
            <SelectItemText>a</SelectItemText>
            {indicatorTestIds ? <SelectItemIndicator data-testid="indicator-a" /> : null}
          </SelectItem>
          <SelectItem value="b">
            <SelectItemText>b</SelectItemText>
            {indicatorTestIds ? <SelectItemIndicator data-testid="indicator-b" /> : null}
          </SelectItem>
        </SelectList>
      </SelectPositioner>
    </Root>
  ));
  tick();
}

describe("<Select.Item />", () => {
  it("commits a single value on click and closes the select", async () => {
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    let captured: SelectStore | undefined;
    renderItems({
      rootProps: { defaultValue: null, onValueChange, onOpenChange },
      onStore: (store) => {
        captured = store;
      },
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("option", { name: "a" }));
    tick();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("a");
    expect(onValueChange.mock.calls[0][1].reason).toBe("item-press");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    expect(captured?.peek("value")).toBe("a");
    expect(captured?.peek("selectedIndex")).toBe(0);
  });

  it("adds and removes values on click in multiple mode", async () => {
    const onValueChange = vi.fn();
    renderItems({ rootProps: { multiple: true, defaultValue: [], onValueChange } });

    const user = userEvent.setup();
    await user.click(screen.getByRole("option", { name: "a" }));
    tick();
    expect(onValueChange).toHaveBeenLastCalledWith(["a"], expect.anything());

    await user.click(screen.getByRole("option", { name: "a" }));
    tick();
    expect(onValueChange).toHaveBeenLastCalledWith([], expect.anything());
  });

  it("commits via keyboard when the item is highlighted", () => {
    const onValueChange = vi.fn();
    let captured: SelectStore | undefined;
    renderItems({
      rootProps: { defaultValue: null, onValueChange },
      onStore: (store) => {
        captured = store;
      },
    });

    captured?.set("activeIndex", 1);
    tick();

    fire(screen.getByRole("option", { name: "b" }), "keydown", { key: "Enter" } as KeyboardEventInit);
    tick();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("b");
  });

  it("marks the selected and highlighted items", () => {
    let captured: SelectStore | undefined;
    renderItems({
      rootProps: { defaultValue: "a" },
      onStore: (store) => {
        captured = store;
      },
    });

    const optionA = screen.getByRole("option", { name: "a" });
    const optionB = screen.getByRole("option", { name: "b" });

    expect(optionA).toHaveAttribute("aria-selected", "true");
    expect(optionA).toHaveAttribute("data-selected", "");
    expect(optionB).toHaveAttribute("aria-selected", "false");
    expect(optionB).not.toHaveAttribute("data-selected");

    captured?.set("activeIndex", 1);
    tick();

    expect(optionB).toHaveAttribute("data-highlighted", "");
    expect(optionA).not.toHaveAttribute("data-highlighted");
  });

  it("renders the indicator only for the selected item", async () => {
    renderItems({ rootProps: { defaultValue: "a" }, indicatorTestIds: true });

    expect(screen.getByTestId("indicator-a")).toHaveTextContent("✔️");
    expect(screen.queryByTestId("indicator-b")).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("option", { name: "b" }));
    tick();

    await vi.waitFor(() => expect(screen.queryByTestId("indicator-a")).toBeNull());
    expect(screen.getByTestId("indicator-b")).toHaveTextContent("✔️");
  });

  it("ignores clicks on disabled items", async () => {
    const onValueChange = vi.fn();
    mount(() => (
      <Root defaultOpen defaultValue={null} onValueChange={onValueChange}>
        <SelectPositioner alignItemWithTrigger={false}>
          <SelectList>
            <SelectItem value="a" disabled>
              <SelectItemText>a</SelectItemText>
            </SelectItem>
          </SelectList>
        </SelectPositioner>
      </Root>
    ));
    tick();

    const option = screen.getByRole("option", { name: "a" });
    expect(option).toHaveAttribute("data-disabled", "");

    const user = userEvent.setup();
    await user.click(option);
    tick();

    expect(onValueChange).not.toHaveBeenCalled();
  });
});

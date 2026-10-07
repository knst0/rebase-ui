import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { Root } from "../index.parts";
import { SelectItemIndicator } from "../item-indicator/SelectItemIndicator";
import { SelectItemText } from "../item-text/SelectItemText";
import { SelectList } from "../list/SelectList";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { SelectItem } from "./SelectItem";

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

function renderItems(options?: { rootProps?: Record<string, any>; onStore?: (store: SelectStore) => void; indicatorTestIds?: boolean }) {
  const { rootProps = {}, onStore, indicatorTestIds = false } = options ?? {};
  render(() => (
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
  flush();
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
    flush();

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
    flush();
    expect(onValueChange).toHaveBeenLastCalledWith(["a"], expect.anything());

    await user.click(screen.getByRole("option", { name: "a" }));
    flush();
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
    flush();

    fireEvent.keyDown(screen.getByRole("option", { name: "b" }), { key: "Enter" });
    flush();

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
    flush();

    expect(optionB).toHaveAttribute("data-highlighted", "");
    expect(optionA).not.toHaveAttribute("data-highlighted");
  });

  it("renders the indicator only for the selected item", async () => {
    renderItems({ rootProps: { defaultValue: "a" }, indicatorTestIds: true });

    expect(screen.getByTestId("indicator-a")).toHaveTextContent("✔️");
    expect(screen.queryByTestId("indicator-b")).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("option", { name: "b" }));
    flush();

    await waitFor(() => expect(screen.queryByTestId("indicator-a")).toBeNull());
    expect(screen.getByTestId("indicator-b")).toHaveTextContent("✔️");
  });

  it("ignores clicks on disabled items", async () => {
    const onValueChange = vi.fn();
    render(() => (
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
    flush();

    const option = screen.getByRole("option", { name: "a" });
    expect(option).toHaveAttribute("data-disabled", "");

    const user = userEvent.setup();
    await user.click(option);
    flush();

    expect(onValueChange).not.toHaveBeenCalled();
  });
});

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxList } from "../list/ComboboxList";
import { ComboboxPopup } from "../popup/ComboboxPopup";
import { ComboboxPortal } from "../portal/ComboboxPortal";
import { ComboboxPositioner } from "../positioner/ComboboxPositioner";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { AriaCombobox } from "../root/AriaCombobox";
import { useComboboxRootContext } from "../root/ComboboxRootContext";
import type { ComboboxStore } from "../store/ComboboxStore";
import { ComboboxItemIndicator } from "../item-indicator/ComboboxItemIndicator";
import { ComboboxRow } from "../row/ComboboxRow";
import { ComboboxItem } from "./ComboboxItem";

function CaptureStore(props: { onStore: (store: ComboboxStore) => void }) {
  props.onStore(useComboboxRootContext() as ComboboxStore);
  return null;
}

function renderItems(options?: {
  rootProps?: Record<string, unknown>;
  onStore?: (store: ComboboxStore) => void;
  indicatorTestIds?: boolean;
}) {
  const { rootProps = {}, onStore, indicatorTestIds = false } = options ?? {};
  render(() => (
    <ComboboxRoot defaultOpen defaultValue={null} {...rootProps}>
      {onStore ? (
        <CaptureStore
          onStore={(store) => {
            onStore(store);
          }}
        />
      ) : null}
      <ComboboxInput />
      <ComboboxPortal>
        <ComboboxPositioner>
          <ComboboxPopup>
            <ComboboxList>
              <ComboboxItem value="a">
                a{indicatorTestIds ? <ComboboxItemIndicator data-testid="indicator-a" /> : null}
              </ComboboxItem>
              <ComboboxItem value="b">
                b{indicatorTestIds ? <ComboboxItemIndicator data-testid="indicator-b" /> : null}
              </ComboboxItem>
            </ComboboxList>
          </ComboboxPopup>
        </ComboboxPositioner>
      </ComboboxPortal>
    </ComboboxRoot>
  ));
  flush();
}

describe("<Combobox.Item />", () => {
  it("selects the item and closes in single mode", async () => {
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    let captured: ComboboxStore | undefined;
    renderItems({
      rootProps: { onValueChange, onOpenChange },
      onStore: (store) => {
        captured = store;
      },
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("option", { name: "a" }));
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("a");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    expect(captured?.peek("selectedValue")).toBe("a");
    expect(captured?.peek("selectedIndex")).toBe(0);
  });

  it("toggles selection and stays open in multiple mode", async () => {
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

  it("does not select a disabled item", async () => {
    const onValueChange = vi.fn();
    render(() => (
      <ComboboxRoot defaultOpen defaultValue={null} onValueChange={onValueChange}>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxItem value="a" disabled>
                  a
                </ComboboxItem>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();

    const user = userEvent.setup();
    await user.click(screen.getByRole("option", { name: "a" }));
    flush();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "a" })).toHaveAttribute("data-disabled", "");
  });

  it("inherits the disabled state from the root", async () => {
    const onValueChange = vi.fn();
    renderItems({ rootProps: { disabled: true, onValueChange } });

    const user = userEvent.setup();
    await user.click(screen.getByRole("option", { name: "a" }));
    flush();

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("marks the selected and highlighted items", () => {
    let captured: ComboboxStore | undefined;
    renderItems({
      rootProps: { defaultValue: "b" },
      onStore: (store) => {
        captured = store;
      },
    });

    captured?.set("activeIndex", 0);
    flush();

    const itemA = screen.getByRole("option", { name: "a" });
    const itemB = screen.getByRole("option", { name: "b" });

    expect(itemA).toHaveAttribute("data-highlighted", "");
    expect(itemA).not.toHaveAttribute("data-selected");
    expect(itemA).toHaveAttribute("aria-selected", "false");

    expect(itemB).toHaveAttribute("data-selected", "");
    expect(itemB).not.toHaveAttribute("data-highlighted");
    expect(itemB).toHaveAttribute("aria-selected", "true");
  });

  it("renders the indicator only for the selected item", () => {
    renderItems({ rootProps: { defaultValue: "b" }, indicatorTestIds: true });

    expect(screen.queryByTestId("indicator-a")).toBe(null);
    expect(screen.getByTestId("indicator-b")).toBeInTheDocument();
  });

  it("commits via mouseup when the item is highlighted without a preceding pointerdown on it", () => {
    const onValueChange = vi.fn();
    let captured: ComboboxStore | undefined;
    renderItems({
      rootProps: { onValueChange },
      onStore: (store) => {
        captured = store;
      },
    });

    captured?.set("activeIndex", 1);
    flush();

    fireEvent.mouseUp(screen.getByRole("option", { name: "b" }), { button: 0 });
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("b");
  });

  it("matches values with a custom equality function", () => {
    render(() => (
      <ComboboxRoot
        defaultOpen
        defaultValue={{ id: 1 }}
        isItemEqualToValue={(itemValue: { id: number }, selectedValue: { id: number }) =>
          itemValue?.id === selectedValue?.id
        }
      >
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxItem value={{ id: 1 }}>one</ComboboxItem>
                <ComboboxItem value={{ id: 2 }}>two</ComboboxItem>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();

    expect(screen.getByRole("option", { name: "one" })).toHaveAttribute("data-selected", "");
    expect(screen.getByRole("option", { name: "two" })).not.toHaveAttribute("data-selected");
  });

  it("renders as a gridcell inside a row when the root is a grid", () => {
    render(() => (
      <ComboboxRoot defaultOpen defaultValue={null} grid>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxRow>
                  <ComboboxItem value="a">a</ComboboxItem>
                </ComboboxRow>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();
    const item = screen.getByRole("gridcell", { name: "a" });
    expect(item).toHaveAttribute("role", "gridcell");
    expect(item).toHaveAttribute("aria-selected", "false");
  });

  it("omits aria-selected when selection is disabled", () => {
    render(() => (
      <AriaCombobox defaultOpen selectionMode="none">
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxItem value="a">a</ComboboxItem>
                <ComboboxItem value="b">b</ComboboxItem>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </AriaCombobox>
    ));
    flush();

    expect(screen.getByRole("option", { name: "a" })).not.toHaveAttribute("aria-selected");
  });
});

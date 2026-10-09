import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Combobox from "../index.parts";
import { ComboboxList } from "./ComboboxList";

describe("<Combobox.List />", () => {
  it("renders a listbox labelled by the floating id", async () => {
    render(() => (
      <Combobox.Root defaultOpen items={["Apple", "Banana"]}>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <ComboboxList data-testid="list">
                <Combobox.Collection>
                  {(item: unknown) => {
                    const value = item as string;
                    return <Combobox.Item value={value}>{value}</Combobox.Item>;
                  }}
                </Combobox.Collection>
              </ComboboxList>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();

    const list = screen.getByTestId("list");
    expect(list).toHaveAttribute("role", "listbox");
    expect(list).toHaveAttribute("tabindex", "-1");
    expect(list.id).not.toBe("");
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("maps function children over the filtered items without a collection", async () => {
    render(() => (
      <Combobox.Root defaultOpen items={["Apple", "Banana", "Cherry"]}>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <ComboboxList data-testid="list">{(item: unknown) => <div data-testid="row">{String(item)}</div>}</ComboboxList>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();

    const rows = screen.getAllByTestId("row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Apple");
  });

  it("does not render aria-orientation on the listbox role", async () => {
    render(() => (
      <Combobox.Root defaultOpen items={["Apple"]}>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <ComboboxList data-testid="list">
                <Combobox.Collection>
                  {(item: unknown) => {
                    const value = item as string;
                    return <Combobox.Item value={value}>{value}</Combobox.Item>;
                  }}
                </Combobox.Collection>
              </ComboboxList>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();

    // `listbox` is implicitly vertical.
    const list = screen.getByTestId("list");
    expect(list).toHaveAttribute("role", "listbox");
    expect(list).not.toHaveAttribute("aria-orientation");
  });

  it("does not render aria-orientation on the grid role", async () => {
    render(() => (
      <Combobox.Root defaultOpen grid items={["Apple"]}>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <ComboboxList data-testid="list">
                <Combobox.Collection>
                  {(item: unknown) => {
                    const value = item as string;
                    return <Combobox.Item value={value}>{value}</Combobox.Item>;
                  }}
                </Combobox.Collection>
              </ComboboxList>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();

    // The grid role does not support aria-orientation (axe: aria-allowed-attr).
    const list = screen.getByTestId("list");
    expect(list).toHaveAttribute("role", "grid");
    expect(list).not.toHaveAttribute("aria-orientation");
  });

  it("uses the grid role when the combobox is in grid mode", async () => {
    render(() => (
      <Combobox.Root defaultOpen grid items={["Apple"]}>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <ComboboxList data-testid="list">
                <Combobox.Collection>
                  {(item: unknown) => {
                    const value = item as string;
                    return <Combobox.Item value={value}>{value}</Combobox.Item>;
                  }}
                </Combobox.Collection>
              </ComboboxList>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("list")).toHaveAttribute("role", "grid");
  });
});

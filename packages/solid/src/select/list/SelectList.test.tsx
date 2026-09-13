import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { Root } from "../index.parts";
import { SelectItem } from "../item/SelectItem";
import { SelectItemText } from "../item-text/SelectItemText";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { SelectList } from "./SelectList";

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

describe("<Select.List />", () => {
  it("renders a listbox and registers its items for keyboard navigation and typeahead", () => {
    let captured: SelectStore | undefined;
    render(() => (
      <Root defaultOpen>
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
    flush();

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(listbox.id).toMatch(/-list$/);
    expect(screen.getAllByRole("option")).toHaveLength(2);

    expect(captured?.peek("listElement")).toBe(listbox);
    expect(captured?.context.listRef.current).toHaveLength(2);
    expect(captured?.context.valuesRef.current).toEqual(["a", "b"]);
    expect(captured?.context.labelsRef.current).toEqual(["a", "b"]);
  });

  it("exposes multiselect semantics when the root is multiple", () => {
    render(() => (
      <Root defaultOpen multiple>
        <SelectPositioner alignItemWithTrigger={false}>
          <SelectList>
            <SelectItem value="a">
              <SelectItemText>a</SelectItemText>
            </SelectItem>
          </SelectList>
        </SelectPositioner>
      </Root>
    ));
    flush();

    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
  });

  it("forwards list scrolls to the popup scroll handler so the arrows update", () => {
    let captured: SelectStore | undefined;
    render(() => (
      <Root defaultOpen>
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
          </SelectList>
        </SelectPositioner>
      </Root>
    ));
    flush();

    const handleScroll = vi.fn();
    captured!.context.scrollHandlerRef.current = handleScroll;

    const listbox = screen.getByRole("listbox");
    fireEvent.scroll(listbox);

    expect(handleScroll).toHaveBeenCalledTimes(1);
    expect(handleScroll).toHaveBeenCalledWith(listbox);
  });
});

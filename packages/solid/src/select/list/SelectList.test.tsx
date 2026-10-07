import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { Root } from "../index.parts";
import { SelectItemText } from "../item-text/SelectItemText";
import { SelectItem } from "../item/SelectItem";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
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

  it("does not render aria-orientation on the listbox role", () => {
    render(() => (
      <Root defaultOpen>
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

    // `listbox` is implicitly vertical.
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-orientation");
  });

  it("anchors multiple selection to the first selected item in rendered order", () => {
    let captured: SelectStore | undefined;
    render(() => (
      <Root defaultOpen multiple defaultValue={["b", "a", "c"]}>
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
            <SelectItem value="c">
              <SelectItemText>c</SelectItemText>
            </SelectItem>
          </SelectList>
        </SelectPositioner>
      </Root>
    ));
    flush();

    // `a` renders first but sits in the middle of the value array, so neither
    // end of that array points at it — only the rendered order does.
    expect(captured?.peek("selectedIndex")).toBe(0);
    const anchorText = captured?.context.selectedItemTextRef.current;
    expect(anchorText?.textContent).toBe("a");
    expect(screen.getByRole("option", { name: "a" }).contains(anchorText ?? null)).toBe(true);
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

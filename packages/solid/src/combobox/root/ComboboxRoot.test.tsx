import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { ComboboxRoot } from "./ComboboxRoot";
import {
  useComboboxDerivedItemsContext,
  useComboboxInputValueContext,
  useComboboxRootContext,
} from "./ComboboxRootContext";
import type { ComboboxStore } from "../store/ComboboxStore";

function CaptureStore(props: { onStore: (store: ComboboxStore) => void }) {
  props.onStore(useComboboxRootContext());
  return null;
}

function CaptureInputValue() {
  const inputValue = useComboboxInputValueContext();
  return <span data-testid="input-value">{inputValue()}</span>;
}

function CaptureFiltered() {
  const derived = useComboboxDerivedItemsContext();
  return <span data-testid="filtered">{derived.filteredItems.join(",")}</span>;
}

function renderCombobox(options?: {
  rootProps?: Record<string, any>;
  children?: any;
  onStore?: (store: ComboboxStore) => void;
}) {
  const { rootProps = {}, children = "content", onStore } = options ?? {};
  const result = render(() => (
    <ComboboxRoot {...rootProps}>
      {onStore ? <CaptureStore onStore={onStore} /> : null}
      {children}
    </ComboboxRoot>
  ));
  flush();
  return result;
}

describe("<Combobox.Root />", () => {
  it("renders children and a hidden input carrying the serialized value", () => {
    const { container } = renderCombobox({
      rootProps: { name: "fruit", defaultValue: "apple" },
    });

    expect(screen.getByText("content")).toBeInTheDocument();

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.name).toBe("fruit");
    expect(input.value).toBe("apple");
  });

  it("syncs the uncontrolled default value into the store", () => {
    let captured: ComboboxStore | undefined;
    renderCombobox({
      rootProps: { defaultValue: "apple" },
      onStore: (store) => {
        captured = store;
      },
    });

    expect(captured?.peek("selectedValue")).toBe("apple");
    expect(captured?.peek("hasSelectedValue")).toBe(true);
    expect(captured?.peek("isSelected", "apple")).toBe(true);
    expect(captured?.peek("isSelected", "banana")).toBe(false);
  });

  it("derives the input value from the selection in single mode", () => {
    // Probe elements must be created inside the render closure: Solid 2 resolves
    // context at the element's creation site, so a pre-created element spliced via
    // a variable never sees the root's providers.
    render(() => (
      <ComboboxRoot defaultValue="apple">
        <CaptureInputValue />
      </ComboboxRoot>
    ));
    flush();

    expect(screen.getByTestId("input-value")).toHaveTextContent("apple");
  });

  it("derives filtered items from the items prop", () => {
    render(() => (
      <ComboboxRoot items={["Apple", "Banana"]}>
        <CaptureFiltered />
      </ComboboxRoot>
    ));
    flush();

    expect(screen.getByTestId("filtered")).toHaveTextContent("Apple,Banana");
  });

  it("commits values through setSelectedValue and reports the change reason", () => {
    const onValueChange = vi.fn();
    let captured: ComboboxStore | undefined;
    renderCombobox({
      rootProps: { defaultValue: "apple", onValueChange },
      onStore: (store) => {
        captured = store;
      },
    });

    captured?.context.setSelectedValue("banana", createChangeEventDetails(REASONS.itemPress));
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("banana");
    expect(onValueChange.mock.calls[0][1].reason).toBe(REASONS.itemPress);
    expect(captured?.peek("selectedValue")).toBe("banana");
    expect(captured?.peek("isSelected", "banana")).toBe(true);
    expect(captured?.peek("isSelected", "apple")).toBe(false);
  });

  it("respects canceled value changes", () => {
    const onValueChange = vi.fn((value: unknown, eventDetails: { cancel(): void }) => {
      eventDetails.cancel();
    });
    let captured: ComboboxStore | undefined;
    renderCombobox({
      rootProps: { defaultValue: "apple", onValueChange },
      onStore: (store) => {
        captured = store;
      },
    });

    captured?.context.setSelectedValue("banana", createChangeEventDetails(REASONS.itemPress));
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(captured?.peek("selectedValue")).toBe("apple");
  });

  it("toggles open state through setOpen and reports open changes", () => {
    const onOpenChange = vi.fn();
    let captured: ComboboxStore | undefined;
    renderCombobox({
      rootProps: { onOpenChange },
      onStore: (store) => {
        captured = store;
      },
    });

    expect(captured?.peek("open")).toBe(false);

    captured?.context.setOpen(true, createChangeEventDetails(REASONS.inputPress));
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe(REASONS.inputPress);
    expect(captured?.peek("open")).toBe(true);

    captured?.context.setOpen(false, createChangeEventDetails(REASONS.escapeKey));
    flush();

    expect(captured?.peek("open")).toBe(false);
    const lastCall = onOpenChange.mock.calls[onOpenChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(false);
    expect(lastCall[1].reason).toBe(REASONS.escapeKey);
  });

  it("respects canceled open changes", () => {
    const onOpenChange = vi.fn((open: boolean, eventDetails: { cancel(): void }) => {
      eventDetails.cancel();
    });
    let captured: ComboboxStore | undefined;
    renderCombobox({
      rootProps: { onOpenChange },
      onStore: (store) => {
        captured = store;
      },
    });

    captured?.context.setOpen(true, createChangeEventDetails(REASONS.inputPress));
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(captured?.peek("open")).toBe(false);
  });

  it("maps multiple mode to a multiple selection", () => {
    let captured: ComboboxStore | undefined;
    renderCombobox({
      rootProps: { multiple: true, defaultValue: ["apple"] },
      onStore: (store) => {
        captured = store;
      },
    });

    expect(captured?.peek("selectionMode")).toBe("multiple");
    expect(captured?.peek("hasSelectionChips")).toBe(true);
  });
});

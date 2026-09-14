import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { For, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { nextFrames } from "#test-utils";

import { Combobox } from "../index";

const fruits = ["apple", "banana", "cherry"];

function ClosedTemplate() {
  return (
    <Combobox.Root items={fruits}>
      <Combobox.Input data-testid="input" />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              {(item: string, index: number) => (
                <Combobox.Item value={item}>
                  {index}: {item}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function MultipleChips() {
  return (
    <Combobox.Root items={fruits} multiple defaultValue={["apple"]}>
      <Combobox.InputGroup>
        <Combobox.Value>
          {(value: () => string[]) => (
            <Combobox.Chips>
              <For each={value()}>
                {(item) => (
                  <Combobox.Chip aria-label={item}>
                    {item}
                    <Combobox.ChipRemove aria-label={`Remove ${item}`}>×</Combobox.ChipRemove>
                  </Combobox.Chip>
                )}
              </For>
              <Combobox.Input data-testid="input" />
            </Combobox.Chips>
          )}
        </Combobox.Value>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

interface Produce {
  id: string;
  label: string;
}

interface ProduceGroup {
  value: string;
  items: Produce[];
}

const groups: ProduceGroup[] = [
  {
    value: "Fruits",
    items: [
      { id: "apple", label: "Apple" },
      { id: "banana", label: "Banana" },
    ],
  },
  {
    value: "Vegetables",
    items: [
      { id: "carrot", label: "Carrot" },
      { id: "kale", label: "Kale" },
    ],
  },
];

function Grouped() {
  return (
    <Combobox.Root items={groups}>
      <Combobox.Input data-testid="input" />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              {(group: ProduceGroup, index: number) => (
                <Combobox.Group items={group.items}>
                  <Combobox.GroupLabel>
                    {index}: {group.value}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(item: Produce, itemIndex: number) => (
                      <Combobox.Item value={item}>
                        {itemIndex}: {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

/** The full pointer sequence a primary-button tap produces in a browser. */
function pressWithPointer(element: HTMLElement) {
  fireEvent.pointerDown(element, { isPrimary: true, button: 0 });
  fireEvent.mouseDown(element, { button: 0 });
  fireEvent.pointerUp(element, { isPrimary: true, button: 0 });
  fireEvent.mouseUp(element, { button: 0 });
  fireEvent.click(element, { button: 0 });
  flush();
}

function typeInto(input: HTMLElement, value: string) {
  (input as HTMLInputElement).value = value;
  const event = new Event("input", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "inputType", { value: "insertText" });
  input.dispatchEvent(event);
  flush();
}

function optionLabels() {
  return screen.queryAllByRole("option").map((option) => option.textContent);
}

function captureStrictReads() {
  const diagnostics: string[] = [];
  const recordDiagnostic = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
      diagnostics.push(args[0]);
    }
  };
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(recordDiagnostic);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(recordDiagnostic);
  return {
    diagnostics,
    restore() {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    },
  };
}

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await nextFrames();
}

describe("combobox reactivity diagnostics", () => {
  it("reads no reactive values outside a tracking scope while opening, filtering, selecting, and clearing", async () => {
    const capture = captureStrictReads();
    try {
      render(() => <ClosedTemplate />);
      flush();

      const input = screen.getByTestId("input");
      pressWithPointer(input);
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      // Filtering re-renders the rows with their filtered positions, so each
      // row's index updates reactively through the per-row memo.
      typeInto(input, "an");
      expect(optionLabels()).toEqual(["0: banana"]);

      // Clearing restores every row; selecting then clearing exercises the
      // deferred highlight-restore path in the root store.
      typeInto(input, "");
      pressWithPointer(screen.getAllByRole("option")[0]);
      typeInto(input, "");
      await settle();

      expect(capture.diagnostics).toEqual([]);
    } finally {
      capture.restore();
    }
  });

  it("reads no reactive values outside a tracking scope with chips, selection, and removal", async () => {
    const capture = captureStrictReads();
    try {
      render(() => <MultipleChips />);
      flush();

      const input = screen.getByTestId("input");
      pressWithPointer(input);
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      typeInto(input, "an");
      pressWithPointer(screen.getAllByRole("option")[0]);
      pressWithPointer(screen.getByRole("button", { name: "Remove banana" }));
      typeInto(input, "");
      await settle();

      expect(capture.diagnostics).toEqual([]);
    } finally {
      capture.restore();
    }
  });

  it("reads no reactive values outside a tracking scope with grouped collections", async () => {
    const capture = captureStrictReads();
    try {
      render(() => <Grouped />);
      flush();

      const input = screen.getByTestId("input");
      pressWithPointer(input);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(optionLabels()).toEqual(["0: Apple", "1: Banana", "0: Carrot", "1: Kale"]);

      typeInto(input, "car");
      expect(optionLabels()).toEqual(["0: Carrot"]);

      typeInto(input, "");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      flush();
      fireEvent.keyDown(input, { key: "Enter" });
      await settle();

      expect(capture.diagnostics).toEqual([]);
    } finally {
      capture.restore();
    }
  });
});

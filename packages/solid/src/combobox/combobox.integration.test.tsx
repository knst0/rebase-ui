import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { Combobox } from "./index";

const fruits = ["apple", "banana", "cherry"];

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

function Single() {
  return (
    <Combobox.Root items={fruits}>
      <Combobox.Input data-testid="input" />
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

function Multiple() {
  return (
    <Combobox.Root items={fruits} multiple>
      <Combobox.InputGroup>
        <Combobox.Value>
          {(value: () => string[]) => (
            <Combobox.Chips>
              <span data-testid="value">{JSON.stringify(value())}</span>
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

function Grouped() {
  return (
    <Combobox.Root items={groups}>
      <Combobox.Input data-testid="input" />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              {(group: ProduceGroup) => (
                <Combobox.Group items={group.items}>
                  <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(item: Produce) => <Combobox.Item value={item}>{item.label}</Combobox.Item>}
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

describe("combobox interactions", () => {
  it("exposes combobox semantics on the input", () => {
    render(() => <Single />);
    flush();

    const input = screen.getByTestId("input");
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-haspopup", "listbox");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("autocomplete", "off");
  });

  it("opens the popup when the input is pressed", () => {
    render(() => <Single />);
    flush();

    const input = screen.getByTestId("input");
    pressWithPointer(input);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(optionLabels()).toEqual(fruits);
  });

  it("filters the rendered items by the typed query", () => {
    render(() => <Single />);
    flush();

    const input = screen.getByTestId("input");
    pressWithPointer(input);
    typeInto(input, "ban");

    expect(optionLabels()).toEqual(["banana"]);
  });

  it("toggles a selection exactly once per pointer press in multiple mode", () => {
    render(() => <Multiple />);
    flush();

    const input = screen.getByTestId("input");
    pressWithPointer(input);
    // Highlighting makes the `mouseup` drag-select path eligible, which must
    // stay suppressed for a press that started on the same item.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    flush();

    pressWithPointer(screen.getAllByRole("option")[0]);
    expect(screen.getByTestId("value").textContent).toBe('["apple"]');

    pressWithPointer(screen.getAllByRole("option")[2]);
    expect(screen.getByTestId("value").textContent).toBe('["apple","cherry"]');

    pressWithPointer(screen.getAllByRole("option")[0]);
    expect(screen.getByTestId("value").textContent).toBe('["cherry"]');
  });

  it("keeps the input mounted across selections rendered by Combobox.Value", () => {
    render(() => <Multiple />);
    flush();

    const input = screen.getByTestId("input");
    pressWithPointer(input);
    pressWithPointer(screen.getAllByRole("option")[0]);

    expect(screen.getByTestId("value").textContent).toBe('["apple"]');
    expect(screen.getByTestId("input")).toBe(input);
    expect(input.isConnected).toBe(true);
  });

  it("filters grouped items and drops empty groups", () => {
    render(() => <Grouped />);
    flush();

    const input = screen.getByTestId("input");
    pressWithPointer(input);
    expect(optionLabels()).toEqual(["Apple", "Banana", "Carrot", "Kale"]);

    typeInto(input, "car");

    expect(optionLabels()).toEqual(["Carrot"]);
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByRole("group")).toHaveAccessibleName("Vegetables");
  });
});

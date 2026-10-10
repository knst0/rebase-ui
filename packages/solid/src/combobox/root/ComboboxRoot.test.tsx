import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal, flush, For, type Setter } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { expectType, nextFrames } from "#test-utils";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { ComboboxClear } from "../clear/ComboboxClear";
import { ComboboxEmpty } from "../empty/ComboboxEmpty";
import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxItem } from "../item/ComboboxItem";
import { ComboboxList } from "../list/ComboboxList";
import { ComboboxPopup } from "../popup/ComboboxPopup";
import { ComboboxPortal } from "../portal/ComboboxPortal";
import { ComboboxPositioner } from "../positioner/ComboboxPositioner";
import type { ComboboxStore } from "../store/ComboboxStore";
import { ComboboxTrigger } from "../trigger/ComboboxTrigger";
import { ComboboxRoot } from "./ComboboxRoot";
import { useComboboxDerivedItemsContext, useComboboxInputValueContext, useComboboxRootContext } from "./ComboboxRootContext";

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

function renderCombobox(options?: { rootProps?: Record<string, any>; children?: any; onStore?: (store: ComboboxStore) => void }) {
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

function ReadonlyMultipleValues() {
  const [value, setValue] = createSignal<string[]>([]);
  const readonlyValue: readonly string[] = value();
  const tupleValue = ["javascript", "typescript"] as const;

  return (
    <>
      <ComboboxRoot multiple value={readonlyValue} onValueChange={setValue} />
      <ComboboxRoot multiple defaultValue={readonlyValue} onValueChange={setValue} />
      <ComboboxRoot
        multiple
        value={tupleValue}
        onValueChange={(newValue) => {
          expectType<("javascript" | "typescript")[], typeof newValue>(newValue);
          newValue.pop();
        }}
      />
      <ComboboxRoot multiple defaultValue={tupleValue} onValueChange={setValue} />
    </>
  );
}

void ReadonlyMultipleValues;

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

function HighlightCombobox(props: { onItemHighlighted: ComboboxRoot.Props<string>["onItemHighlighted"] }) {
  return (
    <ComboboxRoot items={["apple", "apricot", "banana"]} onItemHighlighted={props.onItemHighlighted}>
      <ComboboxInput data-testid="input" />
      <ComboboxClear data-testid="clear" keepMounted />
      <ComboboxPortal>
        <ComboboxPositioner>
          <ComboboxPopup>
            <ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
          </ComboboxPopup>
        </ComboboxPositioner>
      </ComboboxPortal>
    </ComboboxRoot>
  );
}

async function highlightFirstWithKeyboard(onItemHighlighted: ReturnType<typeof vi.fn>) {
  pressWithPointer(screen.getByTestId("input"));
  await screen.findByRole("listbox");
  fireEvent.keyDown(screen.getByTestId("input"), { key: "ArrowDown" });
  flush();
  await waitFor(() => {
    expect(onItemHighlighted).toHaveBeenLastCalledWith("apple", expect.anything());
  });
}

describe("prop: onItemHighlighted", () => {
  it("passes the keydown event for keyboard highlights", async () => {
    const onItemHighlighted = vi.fn();
    render(() => <HighlightCombobox onItemHighlighted={onItemHighlighted} />);
    flush();

    await highlightFirstWithKeyboard(onItemHighlighted);

    const eventDetails = onItemHighlighted.mock.lastCall?.[1];
    expect(eventDetails.reason).toBe("keyboard");
    expect(eventDetails.event).toBeInstanceOf(KeyboardEvent);
    expect(eventDetails.event.key).toBe("ArrowDown");
  });

  it("passes native mouse and pointer events for pointer highlights", async () => {
    const onItemHighlighted = vi.fn();
    render(() => <HighlightCombobox onItemHighlighted={onItemHighlighted} />);
    flush();

    pressWithPointer(screen.getByTestId("input"));
    const option = await screen.findByRole("option", { name: "apricot" });
    // Nonzero movement: jsdom reports a WebKit user agent, and zero-delta moves are ignored.
    const hoverEvent = new MouseEvent("mousemove", { bubbles: true });
    Object.defineProperty(hoverEvent, "movementX", { value: 1 });
    fireEvent(option, hoverEvent);
    flush();

    await waitFor(() => {
      expect(onItemHighlighted).toHaveBeenLastCalledWith("apricot", expect.anything());
    });
    const eventDetails = onItemHighlighted.mock.lastCall?.[1];
    expect(eventDetails.reason).toBe("pointer");
    expect(eventDetails.event).toBe(hoverEvent);
    expect(eventDetails.event).not.toBeInstanceOf(PointerEvent);

    const leaveEvent = new PointerEvent("pointerleave", { pointerType: "mouse" });
    fireEvent(option, leaveEvent);
    flush();
    await waitFor(() => {
      expect(onItemHighlighted).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ reason: "pointer", event: leaveEvent }));
    });
    expect(onItemHighlighted.mock.lastCall?.[1].event).toBe(leaveEvent);
  });

  it("reports a pointer highlight after keyboard navigation", async () => {
    const onItemHighlighted = vi.fn();
    render(() => <HighlightCombobox onItemHighlighted={onItemHighlighted} />);
    flush();
    await highlightFirstWithKeyboard(onItemHighlighted);

    const hoverEvent = new MouseEvent("mousemove", { bubbles: true });
    Object.defineProperty(hoverEvent, "movementX", { value: 1 });
    fireEvent(screen.getByRole("option", { name: "banana" }), hoverEvent);
    flush();
    await waitFor(() => {
      expect(onItemHighlighted).toHaveBeenLastCalledWith("banana", expect.anything());
    });
    expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe("pointer");
  });

  it("reports no keyboard reason when typing clears the highlight", async () => {
    const onItemHighlighted = vi.fn();
    render(() => <HighlightCombobox onItemHighlighted={onItemHighlighted} />);
    flush();
    await highlightFirstWithKeyboard(onItemHighlighted);

    typeInto(screen.getByTestId("input"), "a");
    await waitFor(() => {
      expect(onItemHighlighted).toHaveBeenLastCalledWith(undefined, expect.anything());
    });
    expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe("none");
  });

  it("reports no keyboard reason when the clear button clears the highlight", async () => {
    const onItemHighlighted = vi.fn();
    render(() => <HighlightCombobox onItemHighlighted={onItemHighlighted} />);
    flush();
    await highlightFirstWithKeyboard(onItemHighlighted);

    fireEvent.click(screen.getByTestId("clear"));
    flush();
    await waitFor(() => {
      expect(onItemHighlighted).toHaveBeenLastCalledWith(undefined, expect.anything());
    });
    const details = onItemHighlighted.mock.lastCall?.[1];
    expect(details.reason).toBe("none");
    expect(details.event.type).toBe("click");
  });
});

function HighlightEventTypes() {
  return (
    <ComboboxRoot
      onItemHighlighted={(_item, details) => {
        if (details.reason === "pointer") {
          expectType<MouseEvent | PointerEvent, typeof details.event>(details.event);
          // @ts-expect-error Hover can report a MouseEvent without pointer-specific methods.
          details.event.getCoalescedEvents();
          if (details.event instanceof PointerEvent) {
            expectType<PointerEvent, typeof details.event>(details.event);
            details.event.getCoalescedEvents();
          }
        } else if (details.reason === "keyboard") {
          expectType<KeyboardEvent, typeof details.event>(details.event);
        } else {
          expectType<Event, typeof details.event>(details.event);
        }
      }}
    />
  );
}

void HighlightEventTypes;

describe("prop: autoHighlight", () => {
  describe("asynchronous items", () => {
    function AsyncCombobox(props: {
      items?: Array<string>;
      dataProp?: "items" | "filteredItems";
      onItemHighlighted?: ComboboxRoot.Props<string>["onItemHighlighted"];
      onValueChange?: ComboboxRoot.Props<string>["onValueChange"];
      onOpenChange?: ComboboxRoot.Props<string>["onOpenChange"];
      onInputValueChange?: ComboboxRoot.Props<string>["onInputValueChange"];
      inputValue?: string;
      open?: boolean;
      autoHighlight?: boolean;
    }) {
      const data = () => (props.dataProp === "filteredItems" ? { filteredItems: props.items ?? [] } : { items: props.items ?? [] });
      return (
        <ComboboxRoot
          {...data()}
          autoHighlight={props.autoHighlight ?? true}
          filter={null}
          inputValue={props.inputValue}
          onInputValueChange={props.onInputValueChange}
          onItemHighlighted={props.onItemHighlighted}
          onValueChange={props.onValueChange}
          onOpenChange={props.onOpenChange}
          open={props.open}
        >
          <ComboboxInput data-testid="input" />
          <ComboboxTrigger data-testid="trigger" />
          <ComboboxPortal>
            <ComboboxPositioner>
              <ComboboxPopup>
                <ComboboxEmpty>No matches</ComboboxEmpty>
                <ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
              </ComboboxPopup>
            </ComboboxPositioner>
          </ComboboxPortal>
        </ComboboxRoot>
      );
    }

    it.each(["items", "filteredItems"] as const)("highlights a candidate arriving after typing with %s", async (dataProp) => {
      const onItemHighlighted = vi.fn();
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      const [items, setItems] = createSignal<Array<string>>([]);
      render(() => (
        <AsyncCombobox dataProp={dataProp} onItemHighlighted={onItemHighlighted} onValueChange={onValueChange} items={items()} />
      ));
      flush();

      const input = screen.getByRole("combobox");
      await user.type(input, "32");
      onItemHighlighted.mockClear();
      setItems(["32", "320"]);
      flush();

      const option = screen.getByRole("option", { name: "32" });
      expect(option).toHaveAttribute("data-highlighted");
      expect(input).toHaveAttribute("aria-activedescendant", option.id);
      expect(onItemHighlighted).toHaveBeenCalledTimes(1);
      expect(onItemHighlighted).toHaveBeenLastCalledWith("32", expect.objectContaining({ index: 0, reason: "none" }));

      await user.keyboard("{Enter}");
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenLastCalledWith("32", expect.anything());
    });

    it("waits for a controlled popup to open", async () => {
      const user = userEvent.setup();
      const [open, setOpen] = createSignal(false);
      render(() => <AsyncCombobox items={["32"]} open={open()} />);
      flush();

      await user.type(screen.getByRole("combobox"), "32");
      setOpen(true);
      flush();

      expect(screen.getByRole("option")).toHaveAttribute("data-highlighted");
    });

    it("discards the request when a rejected typed open is followed by a controlled open", async () => {
      const user = userEvent.setup();
      const [open, setOpen] = createSignal(false);
      render(() => (
        <AsyncCombobox
          items={["32"]}
          open={open()}
          onOpenChange={(nextOpen, details) => {
            if (nextOpen && details.reason === "input-change") {
              details.cancel();
            }
          }}
        />
      ));
      flush();

      await user.type(screen.getByRole("combobox"), "32");
      setOpen(true);
      flush();

      expect(screen.getByRole("option")).not.toHaveAttribute("data-highlighted");
    });

    it("keeps a hovered item highlighted when individually rendered items arrive", async () => {
      const user = userEvent.setup();
      const [results, setResults] = createSignal<Array<string>>([]);
      render(() => (
        <ComboboxRoot autoHighlight>
          <ComboboxInput data-testid="input" />
          <ComboboxPortal>
            <ComboboxPositioner>
              <ComboboxPopup>
                <ComboboxList>
                  <For each={results()}>{(item) => <ComboboxItem value={item}>{item}</ComboboxItem>}</For>
                </ComboboxList>
              </ComboboxPopup>
            </ComboboxPositioner>
          </ComboboxPortal>
        </ComboboxRoot>
      ));
      flush();

      await user.type(screen.getByRole("combobox"), "a");
      setResults(["a1", "a2", "a3"]);
      flush();

      const option = screen.getByRole("option", { name: "a3" });
      // Nonzero movement: jsdom reports a WebKit user agent, and zero-delta moves are ignored.
      const hoverEvent = new MouseEvent("mousemove", { bubbles: true });
      Object.defineProperty(hoverEvent, "movementX", { value: 1 });
      fireEvent(option, hoverEvent);
      flush();

      expect(option).toHaveAttribute("data-highlighted");
    });

    it("highlights the first result when typing filters out individually rendered items", async () => {
      const user = userEvent.setup();
      const [query, setQuery] = createSignal("");
      const fruits = () => ["apple", "banana", "blackberry", "blueberry"].filter((fruit) => fruit.includes(query()));
      render(() => (
        <ComboboxRoot autoHighlight onInputValueChange={setQuery}>
          <ComboboxInput data-testid="input" />
          <ComboboxPortal>
            <ComboboxPositioner>
              <ComboboxPopup>
                <ComboboxList>
                  <For each={fruits()}>{(fruit) => <ComboboxItem value={fruit}>{fruit}</ComboboxItem>}</For>
                </ComboboxList>
              </ComboboxPopup>
            </ComboboxPositioner>
          </ComboboxPortal>
        </ComboboxRoot>
      ));
      flush();

      const input = screen.getByRole("combobox");
      await user.type(input, "b");
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("option", { name: "blackberry" })).toHaveAttribute("data-highlighted");

      await user.type(input, "l");
      const option = screen.getByRole("option", { name: "blackberry" });
      expect(option).toHaveAttribute("data-highlighted");
      expect(input).toHaveAttribute("aria-activedescendant", option.id);
    });

    it("discards the request when an ignored typed open is followed by another open", async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      const [open, setOpen] = createSignal(false);
      render(() => <AsyncCombobox items={["32"]} open={open()} onOpenChange={onOpenChange} />);
      flush();

      await user.type(screen.getByRole("combobox"), "32");
      await user.click(screen.getByTestId("trigger"));
      // A trigger press opens on the frame after `mousedown`, which `user.click` can beat.
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: REASONS.triggerPress }));
      });
      setOpen(true);
      flush();

      expect(screen.getByRole("option")).not.toHaveAttribute("data-highlighted");
    });

    it.each(["Trigger", "ArrowDown"] as const)(
      "discards the request when a rejected typed open is followed by opening with %s",
      async (method) => {
        const user = userEvent.setup();
        render(() => (
          <AsyncCombobox
            items={["32", "320"]}
            onOpenChange={(nextOpen, details) => {
              if (nextOpen && details.reason === "input-change") {
                details.cancel();
              }
            }}
          />
        ));
        flush();

        const input = screen.getByRole("combobox");
        input.focus();
        await user.keyboard("32");
        expect(screen.queryByRole("listbox")).toBe(null);

        if (method === "Trigger") {
          await user.click(screen.getByTestId("trigger"));
        } else {
          await user.keyboard("{ArrowDown}");
        }

        // A trigger press opens on the frame after `mousedown`, which `user.click` can beat.
        const option = await screen.findByRole("option", { name: "32" });
        expect(option).not.toHaveAttribute("data-highlighted");
        expect(input).not.toHaveAttribute("aria-activedescendant");
      },
    );

    it("discards the request when the controlled input is cleared", async () => {
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      const [inputValue, setInputValue] = createSignal("");
      const [items, setItems] = createSignal<Array<string>>([]);
      const [clear, setClear] = createSignal(false);
      render(() => (
        <AsyncCombobox
          items={items()}
          inputValue={clear() ? "" : inputValue()}
          onInputValueChange={setInputValue}
          onValueChange={onValueChange}
        />
      ));
      flush();

      const input = screen.getByRole("combobox");
      await user.type(input, "32");
      setClear(true);
      flush();
      setItems(["32"]);
      flush();

      expect(input).toHaveValue("");
      expect(input).not.toHaveAttribute("aria-activedescendant");
      expect(screen.getByRole("option")).not.toHaveAttribute("data-highlighted");
      await user.keyboard("{Enter}");
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("does not reset keyboard navigation when candidates change", async () => {
      const user = userEvent.setup();
      const [items, setItems] = createSignal<Array<string>>([]);
      render(() => <AsyncCombobox items={items()} />);
      flush();

      await user.type(screen.getByRole("combobox"), "32");
      setItems(["32", "320"]);
      flush();
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("option", { name: "320" })).toHaveAttribute("data-highlighted");
      setItems(["321", "320"]);
      flush();
      expect(screen.getByRole("option", { name: "320" })).toHaveAttribute("data-highlighted");
    });

    it("discards the request when autoHighlight is disabled", async () => {
      const user = userEvent.setup();
      const [items, setItems] = createSignal<Array<string>>([]);
      const [autoHighlight, setAutoHighlight] = createSignal(true);
      render(() => <AsyncCombobox items={items()} autoHighlight={autoHighlight()} />);
      flush();

      await user.type(screen.getByRole("combobox"), "32");
      setAutoHighlight(false);
      flush();
      setAutoHighlight(true);
      setItems(["32"]);
      flush();

      expect(screen.getByRole("option")).not.toHaveAttribute("data-highlighted");
    });
  });

  it("does not auto-highlight on initial open when no selection", async () => {
    render(() => (
      <ComboboxRoot items={["apple", "banana", "cherry"]} autoHighlight defaultOpen>
        <ComboboxInput data-testid="input" />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();

    const input = screen.getByRole("combobox");
    expect(screen.getByRole("listbox")).not.toBe(null);
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  describe("manual unmount lifecycle", () => {
    function UnmountPopup(props: {
      openSignal?: () => boolean | undefined;
      defaultOpen?: boolean;
      onOpenChange?: (open: boolean, eventDetails: ComboboxRoot.OpenChangeEventDetails) => void;
      onOpenChangeComplete?: (open: boolean) => void;
      actionsRef?: Setter<ComboboxRoot.Actions | null>;
      onStore?: (store: ComboboxStore) => void;
    }) {
      const [uncontrolledOpen, setUncontrolledOpen] = createSignal(props.defaultOpen ?? false);
      return (
        <ComboboxRoot
          items={["apple"]}
          open={props.openSignal?.() ?? uncontrolledOpen()}
          onOpenChange={(nextOpen, eventDetails) => {
            props.onOpenChange?.(nextOpen, eventDetails);
            if (!eventDetails.isCanceled && props.openSignal === undefined) {
              setUncontrolledOpen(nextOpen);
            }
          }}
          onOpenChangeComplete={props.onOpenChangeComplete}
          actionsRef={props.actionsRef}
        >
          {props.onStore ? <CaptureStore onStore={props.onStore} /> : null}
          <ComboboxInput data-testid="input" />
          <ComboboxPortal>
            <ComboboxPositioner>
              <ComboboxPopup>
                <ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
              </ComboboxPopup>
            </ComboboxPositioner>
          </ComboboxPortal>
        </ComboboxRoot>
      );
    }

    function renderUnmountPopup(
      props: Pick<
        Parameters<typeof UnmountPopup>[0],
        "openSignal" | "defaultOpen" | "onOpenChange" | "onOpenChangeComplete" | "actionsRef"
      >,
    ) {
      let captured: ComboboxStore | undefined;
      render(() => (
        <UnmountPopup
          {...props}
          onStore={(store) => {
            captured = store;
          }}
        />
      ));
      flush();
      return {
        get store() {
          return captured as ComboboxStore;
        },
      };
    }

    function closeCount(spy: ReturnType<typeof vi.fn>) {
      return spy.mock.calls.filter(([open]) => !open).length;
    }

    it("automatically unmounts with an actions ref and completes closing once", async () => {
      const [actions, setActions] = createSignal<ComboboxRoot.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const { store } = renderUnmountPopup({ defaultOpen: true, actionsRef: setActions, onOpenChangeComplete });
      await nextFrames();

      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.queryByRole("listbox")).not.toBeNull();

      flush(() => store.context.setOpen(false, createChangeEventDetails(REASONS.escapeKey)));
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

      expect(actions()).not.toBeNull();
      expect(typeof actions()?.unmount).toBe("function");
      expect(typeof actions()?.close).toBe("function");
      expect(closeCount(onOpenChangeComplete)).toBe(1);
    });

    it("keeps the popup mounted until the unmount action completes closing", async () => {
      const [actions, setActions] = createSignal<ComboboxRoot.Actions | null>(null);
      const [open, setOpen] = createSignal(true);
      const onOpenChangeComplete = vi.fn();
      const { store } = renderUnmountPopup({
        openSignal: open,
        actionsRef: setActions,
        onOpenChangeComplete,
        onOpenChange: (nextOpen, eventDetails) => {
          if (!nextOpen) {
            eventDetails.preventUnmountOnClose();
          }
          if (!eventDetails.isCanceled) {
            setOpen(nextOpen);
          }
        },
      });
      await nextFrames();

      flush(() => store.context.setOpen(false, createChangeEventDetails(REASONS.itemPress)));
      await nextFrames();
      await nextFrames();
      expect(screen.queryByRole("listbox")).not.toBeNull();
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      flush(() => actions()?.unmount());
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(closeCount(onOpenChangeComplete)).toBe(1);

      // Let the unmount's deferred focus return settle while closed: reopening in the same
      // task would race it and the stale focus would close the reopened popup again.
      await nextFrames();
      flush(() => setOpen(true));
      await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeNull());
      flush(() => setOpen(false));
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(closeCount(onOpenChangeComplete)).toBe(2);
    });

    it("clears the opt-out when a controlled reopen interrupts a pending unmount", async () => {
      const [open, setOpen] = createSignal(true);
      const onOpenChangeComplete = vi.fn();
      const { store } = renderUnmountPopup({
        openSignal: open,
        onOpenChangeComplete,
        onOpenChange: (nextOpen, eventDetails) => {
          if (!nextOpen) {
            eventDetails.preventUnmountOnClose();
          }
          if (!eventDetails.isCanceled) {
            setOpen(nextOpen);
          }
        },
      });
      await nextFrames();

      flush(() => store.context.setOpen(false, createChangeEventDetails(REASONS.itemPress)));
      await nextFrames();
      await nextFrames();
      expect(screen.queryByRole("listbox")).not.toBeNull();
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      flush(() => setOpen(true));
      await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeNull());
      flush(() => setOpen(false));
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(closeCount(onOpenChangeComplete)).toBe(1);
    });

    it("ignores an opt-out on a canceled close", async () => {
      let cancel = true;
      const { store } = renderUnmountPopup({
        defaultOpen: true,
        onOpenChange: (nextOpen, eventDetails) => {
          if (!nextOpen && cancel) {
            eventDetails.preventUnmountOnClose();
            eventDetails.cancel();
          }
        },
      });
      await nextFrames();

      flush(() => store.context.setOpen(false, createChangeEventDetails(REASONS.itemPress)));
      await nextFrames();
      expect(store.peek("open")).toBe(true);
      expect(screen.queryByRole("listbox")).not.toBeNull();

      cancel = false;
      flush(() => store.context.setOpen(false, createChangeEventDetails(REASONS.itemPress)));
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    });

    it("completes closing once when unmount is called repeatedly", async () => {
      const [actions, setActions] = createSignal<ComboboxRoot.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const { store } = renderUnmountPopup({ defaultOpen: true, actionsRef: setActions, onOpenChangeComplete });
      await nextFrames();

      flush(() => store.context.setOpen(false, createChangeEventDetails(REASONS.escapeKey)));
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(closeCount(onOpenChangeComplete)).toBe(1);

      flush(() => {
        actions()?.unmount();
        actions()?.unmount();
      });
      await nextFrames();
      expect(store.peek("mounted")).toBe(false);
      expect(closeCount(onOpenChangeComplete)).toBe(1);
    });

    it("stays mounted when unmounted while open and still closes afterwards", async () => {
      const [actions, setActions] = createSignal<ComboboxRoot.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const { store } = renderUnmountPopup({ defaultOpen: true, actionsRef: setActions, onOpenChangeComplete });
      await nextFrames();

      // Matches upstream: unmounting while open runs the completion once without an
      // observable unmount (no focus return), and the later close completes closing again.
      flush(() => actions()?.unmount());
      await nextFrames();
      expect(store.peek("open")).toBe(true);
      expect(screen.queryByRole("listbox")).not.toBeNull();

      flush(() => store.context.setOpen(false, createChangeEventDetails(REASONS.escapeKey)));
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(closeCount(onOpenChangeComplete)).toBe(2);
    });

    it("closes the popup through the close action", async () => {
      const [actions, setActions] = createSignal<ComboboxRoot.Actions | null>(null);
      const onOpenChange = vi.fn();
      const { store } = renderUnmountPopup({ defaultOpen: true, actionsRef: setActions, onOpenChange });
      await nextFrames();

      flush(() => actions()?.close());
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

      expect(store.peek("open")).toBe(false);
      expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: REASONS.imperativeAction }));
    });
  });
});

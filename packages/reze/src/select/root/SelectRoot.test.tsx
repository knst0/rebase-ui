import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import * as Select from "../index.parts";
import type { SelectStore } from "../store/SelectStore";
import { useSelectRootContext } from "./SelectRootContext";

afterEach(cleanup);

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

function renderSelect(options?: { rootProps?: Record<string, any>; children?: any; onStore?: (store: SelectStore) => void }) {
  const { rootProps = {}, children = "content", onStore } = options ?? {};
  const result = mount(() => (
    <Select.Root {...rootProps}>
      {onStore ? <CaptureStore onStore={onStore} /> : null}
      {children}
    </Select.Root>
  ));
  tick();
  return result;
}

function fireKey(element: Element, type: "keydown" | "keyup", init: KeyboardEventInit): void {
  fire(element, type, init);
}

describe("<Select.Root />", () => {
  it("renders children and a hidden input carrying the serialized value", () => {
    const { el } = renderSelect({
      rootProps: { name: "font", defaultValue: "serif" },
    });

    expect(screen.getByText("content")).toBeInTheDocument();

    const input = el.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.name).toBe("font");
    expect(input.value).toBe("serif");
  });

  it("syncs the uncontrolled default value into the store", () => {
    let captured: SelectStore | undefined;
    renderSelect({
      rootProps: { defaultValue: "mono" },
      onStore: (store) => {
        captured = store;
      },
    });

    expect(captured?.peek("value")).toBe("mono");
    expect(captured?.peek("hasSelectedValue")).toBe(true);
  });

  it("commits values through setValue and reports the change reason", () => {
    const onValueChange = vi.fn();
    let captured: SelectStore | undefined;
    renderSelect({
      rootProps: { defaultValue: "sans", onValueChange },
      onStore: (store) => {
        captured = store;
      },
    });

    captured?.context.setValue("serif", createChangeEventDetails(REASONS.itemPress));
    tick();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("serif");
    expect(onValueChange.mock.calls[0][1].reason).toBe(REASONS.itemPress);
    expect(captured?.peek("value")).toBe("serif");
    expect(captured?.peek("isSelected", "serif")).toBe(true);
    expect(captured?.peek("isSelected", "sans")).toBe(false);
  });

  it("respects canceled value changes", () => {
    const onValueChange = vi.fn((value: unknown, eventDetails: { cancel(): void }) => {
      eventDetails.cancel();
    });
    let captured: SelectStore | undefined;
    renderSelect({
      rootProps: { defaultValue: "sans", onValueChange },
      onStore: (store) => {
        captured = store;
      },
    });

    captured?.context.setValue("serif", createChangeEventDetails(REASONS.itemPress));
    tick();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(captured?.peek("value")).toBe("sans");
  });

  it("toggles open state through setOpen and reports open changes", () => {
    const onOpenChange = vi.fn();
    let captured: SelectStore | undefined;
    renderSelect({
      rootProps: { onOpenChange },
      onStore: (store) => {
        captured = store;
      },
    });

    expect(captured?.peek("open")).toBe(false);

    captured?.context.setOpen(true, createChangeEventDetails(REASONS.triggerPress));
    tick();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe(REASONS.triggerPress);
    expect(captured?.peek("open")).toBe(true);

    captured?.context.setOpen(false, createChangeEventDetails(REASONS.escapeKey));
    tick();

    expect(captured?.peek("open")).toBe(false);
    const lastCall = onOpenChange.mock.calls[onOpenChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(false);
    expect(lastCall[1].reason).toBe(REASONS.escapeKey);
  });

  it("respects canceled open changes", () => {
    const onOpenChange = vi.fn((open: boolean, eventDetails: { cancel(): void }) => {
      eventDetails.cancel();
    });
    let captured: SelectStore | undefined;
    renderSelect({
      rootProps: { onOpenChange },
      onStore: (store) => {
        captured = store;
      },
    });

    captured?.context.setOpen(true, createChangeEventDetails(REASONS.triggerPress));
    tick();

    expect(captured?.peek("open")).toBe(false);
  });

  it("syncs a controlled value prop into the store", async () => {
    let setValue!: (value: any) => void;
    let captured: SelectStore | undefined;
    function Test() {
      let value = signal<any>("sans");
      setValue = (next: any) => {
        value = next;
      };
      return (
        <Select.Root
          value={value}
          onValueChange={(next) => {
            value = next;
          }}
        >
          <CaptureStore
            onStore={(store) => {
              captured = store;
            }}
          />
        </Select.Root>
      );
    }
    const { el } = mount(() => <Test />);
    tick();
    await nextFrames();

    expect(captured?.peek("value")).toBe("sans");

    setValue("serif");
    tick();
    await nextFrames();

    expect(captured?.peek("value")).toBe("serif");
    const input = el.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("serif");
  });

  it("supports a controlled open prop", async () => {
    let setOpen!: (value: boolean) => void;
    let captured: SelectStore | undefined;
    function Test() {
      let open = signal(false);
      setOpen = (next: boolean) => {
        open = next;
      };
      return (
        <Select.Root
          open={open}
          onOpenChange={(next) => {
            open = next;
          }}
        >
          <CaptureStore
            onStore={(store) => {
              captured = store;
            }}
          />
        </Select.Root>
      );
    }
    mount(() => <Test />);
    tick();
    await nextFrames();

    expect(captured?.peek("open")).toBe(false);

    setOpen(true);
    tick();
    await nextFrames();

    expect(captured?.peek("open")).toBe(true);
  });

  it("exposes keyboard interaction props for the trigger and popup", () => {
    let captured: SelectStore | undefined;
    renderSelect({
      onStore: (store) => {
        captured = store;
      },
    });

    const triggerProps = captured?.peek("triggerProps") as Record<string, unknown>;
    const popupProps = captured?.peek("popupProps") as Record<string, unknown>;

    // List navigation + typeahead + click/dismiss handlers for the trigger.
    expect(typeof triggerProps.onKeyDown).toBe("function");
    expect(typeof triggerProps.onClick).toBe("function");
    expect(typeof triggerProps.onPointerDown).toBe("function");
    // Focusable popup props plus floating-side keyboard handlers.
    expect(typeof popupProps.onKeyDown).toBe("function");
    expect(popupProps.tabindex).toBe(-1);
  });

  it("renders per-value hidden inputs in multiple mode", () => {
    const { el } = renderSelect({
      rootProps: { name: "fonts", multiple: true, defaultValue: ["sans", "serif"] },
    });

    const inputs = Array.from(el.querySelectorAll('input[type="hidden"]'));
    expect(inputs.map((input) => (input as HTMLInputElement).value).sort()).toEqual(["sans", "serif"]);
    expect(inputs.every((input) => (input as HTMLInputElement).name === "fonts")).toBe(true);

    // The shared input stays nameless so only per-value entries are submitted.
    const shared = el.querySelector("input:not([type])") as HTMLInputElement;
    expect(shared.name).toBe("");
  });

  it("serializes object values with itemToStringValue for form submission", () => {
    const { el } = renderSelect({
      rootProps: {
        name: "font",
        defaultValue: { id: "sans", label: "Sans" },
        itemToStringValue: (item: { id: string }) => item.id,
      },
    });

    const input = el.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("sans");
  });

  it("publishes disabled and readOnly to the store", () => {
    let captured: SelectStore | undefined;
    renderSelect({
      rootProps: { disabled: true, readOnly: true },
      onStore: (store) => {
        captured = store;
      },
    });

    expect(captured?.peek("disabled")).toBe(true);
    expect(captured?.peek("readOnly")).toBe(true);
  });

  it("syncs root props into the store", () => {
    let setDisabled!: (value: boolean) => void;
    let setHighlightItemOnHover!: (value: boolean) => void;
    let captured: SelectStore | undefined;
    function Test() {
      let disabled = signal(false);
      let highlightItemOnHover = signal(true);
      setDisabled = (next: boolean) => {
        disabled = next;
      };
      setHighlightItemOnHover = (next: boolean) => {
        highlightItemOnHover = next;
      };
      return (
        <Select.Root disabled={disabled} highlightItemOnHover={highlightItemOnHover} multiple required>
          <CaptureStore
            onStore={(store) => {
              captured = store;
            }}
          />
        </Select.Root>
      );
    }
    mount(() => <Test />);
    tick();

    expect(captured?.peek("disabled")).toBe(false);
    expect(captured?.peek("readOnly")).toBe(false);
    expect(captured?.peek("required")).toBe(true);
    expect(captured?.peek("multiple")).toBe(true);
    expect(captured?.peek("highlightItemOnHover")).toBe(true);
    expect(captured?.peek("itemProps")).toBeTypeOf("object");

    setDisabled(true);
    setHighlightItemOnHover(false);
    tick();

    expect(captured?.peek("disabled")).toBe(true);
    expect(captured?.peek("highlightItemOnHover")).toBe(false);
  });

  it("disables the hidden input when disabled", () => {
    const { el } = renderSelect({
      rootProps: { name: "font", disabled: true },
    });

    const input = el.querySelector("input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("moves DOM focus alongside the highlight on arrow keys", async () => {
    let captured: SelectStore | undefined;
    mount(() => (
      <Select.Root>
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
        <Select.Trigger data-testid="trigger">Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner alignItemWithTrigger={false}>
            <Select.Popup>
              <Select.List>
                <Select.Item value="a">
                  <Select.ItemText>a</Select.ItemText>
                </Select.Item>
                <Select.Item value="b">
                  <Select.ItemText>b</Select.ItemText>
                </Select.Item>
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    tick();
    await nextFrames();

    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireKey(trigger, "keydown", { key: "ArrowDown" });
    tick();
    await nextFrames();

    const optionA = screen.getByRole("option", { name: "a" });
    const optionB = screen.getByRole("option", { name: "b" });
    expect(captured?.peek("open")).toBe(true);
    expect(optionA).toHaveAttribute("data-highlighted", "");
    expect(document.activeElement).toBe(optionA);

    // ArrowDown advances n+1 instead of resetting to the first item …
    fireKey(optionA, "keydown", { key: "ArrowDown" });
    tick();
    expect(optionB).toHaveAttribute("data-highlighted", "");
    expect(document.activeElement).toBe(optionB);

    // … and ArrowUp advances n-1 instead of jumping to the last item.
    fireKey(optionB, "keydown", { key: "ArrowUp" });
    tick();
    expect(optionA).toHaveAttribute("data-highlighted", "");
    expect(document.activeElement).toBe(optionA);
  });

  it("records a touch openMethod from pointerdown when the click carries no pointerType", () => {
    let captured: SelectStore | undefined;
    mount(() => (
      <Select.Root>
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
        <Select.Trigger data-testid="trigger">Trigger</Select.Trigger>
      </Select.Root>
    ));
    tick();

    const trigger = screen.getByTestId("trigger");
    trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch" }));
    // Safari/Firefox deliver a plain MouseEvent to click handlers.
    fire(trigger, "click", { detail: 1 } as MouseEventInit);
    tick();

    expect(captured?.peek("openMethod")).toBe("touch");
  });

  describe("manual unmount lifecycle", () => {
    function UnmountPopup(props: {
      openSignal?: () => boolean | undefined;
      defaultOpen?: boolean;
      onOpenChange?: (open: boolean, eventDetails: Select.Root.OpenChangeEventDetails) => void;
      onOpenChangeComplete?: (open: boolean) => void;
      actionsRef?: (actions: Select.Root.Actions | null) => void;
      onStore?: (store: SelectStore) => void;
    }) {
      function Inner() {
        let uncontrolledOpen = signal(props.defaultOpen ?? false);
        return (
          <Select.Root
            open={props.openSignal?.() ?? uncontrolledOpen}
            onOpenChange={(nextOpen, eventDetails) => {
              props.onOpenChange?.(nextOpen, eventDetails);
              if (!eventDetails.isCanceled && props.openSignal === undefined) {
                uncontrolledOpen = nextOpen;
              }
            }}
            onOpenChangeComplete={props.onOpenChangeComplete}
            actionsRef={props.actionsRef}
          >
            {props.onStore ? <CaptureStore onStore={props.onStore} /> : null}
            <Select.Trigger>Trigger</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apple">Apple</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      }
      return <Inner />;
    }

    function renderUnmountPopup(
      props: Pick<
        Parameters<typeof UnmountPopup>[0],
        "openSignal" | "defaultOpen" | "onOpenChange" | "onOpenChangeComplete" | "actionsRef"
      >,
    ) {
      let captured: SelectStore | undefined;
      mount(() => (
        <UnmountPopup
          {...props}
          onStore={(store) => {
            captured = store;
          }}
        />
      ));
      tick();
      return {
        get store() {
          return captured as SelectStore;
        },
      };
    }

    function closeCount(spy: ReturnType<typeof vi.fn>) {
      return spy.mock.calls.filter(([open]) => !open).length;
    }

    it("automatically unmounts with an actions ref and completes closing once", async () => {
      let actions: Select.Root.Actions | null = signal<Select.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const { store } = renderUnmountPopup({
        defaultOpen: true,
        actionsRef: (next) => {
          actions = next;
        },
        onOpenChangeComplete,
      });
      await nextFrames();

      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.queryByRole("listbox")).not.toBeNull();

      store.context.setOpen(false, createChangeEventDetails(REASONS.escapeKey));
      tick();
      await vi.waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

      expect(actions).not.toBeNull();
      expect(typeof actions?.unmount).toBe("function");
      expect(typeof actions?.close).toBe("function");
      expect(closeCount(onOpenChangeComplete)).toBe(1);
    });

    it("keeps the popup mounted until the unmount action completes closing", async () => {
      let actions: Select.Root.Actions | null = signal<Select.Root.Actions | null>(null);
      let setOpen!: (value: boolean) => void;
      let captured: SelectStore | undefined;
      const onOpenChangeComplete = vi.fn();
      function Test() {
        let open = signal(true);
        setOpen = (next: boolean) => {
          open = next;
        };
        return (
          <UnmountPopup
            openSignal={() => open}
            actionsRef={(next) => {
              actions = next;
            }}
            onOpenChangeComplete={onOpenChangeComplete}
            onOpenChange={(nextOpen, eventDetails) => {
              if (!nextOpen) {
                eventDetails.preventUnmountOnClose();
              }
              if (!eventDetails.isCanceled) {
                open = nextOpen;
              }
            }}
            onStore={(store) => {
              captured = store;
            }}
          />
        );
      }
      mount(() => <Test />);
      tick();
      await nextFrames();

      captured?.context.setOpen(false, createChangeEventDetails(REASONS.itemPress));
      tick();
      await nextFrames();
      await nextFrames();
      expect(screen.queryByRole("listbox")).not.toBeNull();
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      actions?.unmount();
      tick();
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(closeCount(onOpenChangeComplete)).toBe(1);

      // Let the unmount's deferred focus return settle while closed: reopening in the same
      // task would race it and the stale focus would close the reopened popup again.
      await nextFrames();
      setOpen(true);
      tick();
      await vi.waitFor(() => expect(screen.queryByRole("listbox")).not.toBeNull());
      setOpen(false);
      tick();
      await vi.waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(closeCount(onOpenChangeComplete)).toBe(2);
    });

    it("clears the opt-out when a controlled reopen interrupts a pending unmount", async () => {
      let setOpen!: (value: boolean) => void;
      let captured: SelectStore | undefined;
      const onOpenChangeComplete = vi.fn();
      function Test() {
        let open = signal(true);
        setOpen = (next: boolean) => {
          open = next;
        };
        return (
          <UnmountPopup
            openSignal={() => open}
            onOpenChangeComplete={onOpenChangeComplete}
            onOpenChange={(nextOpen, eventDetails) => {
              if (!nextOpen) {
                eventDetails.preventUnmountOnClose();
              }
              if (!eventDetails.isCanceled) {
                open = nextOpen;
              }
            }}
            onStore={(store) => {
              captured = store;
            }}
          />
        );
      }
      mount(() => <Test />);
      tick();
      await nextFrames();

      captured?.context.setOpen(false, createChangeEventDetails(REASONS.itemPress));
      tick();
      await nextFrames();
      await nextFrames();
      expect(screen.queryByRole("listbox")).not.toBeNull();
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      setOpen(true);
      tick();
      await vi.waitFor(() => expect(screen.queryByRole("listbox")).not.toBeNull());
      setOpen(false);
      tick();
      await vi.waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
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

      store.context.setOpen(false, createChangeEventDetails(REASONS.itemPress));
      tick();
      await nextFrames();
      expect(store.peek("open")).toBe(true);
      expect(screen.queryByRole("listbox")).not.toBeNull();

      cancel = false;
      store.context.setOpen(false, createChangeEventDetails(REASONS.itemPress));
      tick();
      await vi.waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    });

    it("completes closing once when unmount is called repeatedly", async () => {
      let actions: Select.Root.Actions | null = signal<Select.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const { store } = renderUnmountPopup({
        defaultOpen: true,
        actionsRef: (next) => {
          actions = next;
        },
        onOpenChangeComplete,
      });
      await nextFrames();

      store.context.setOpen(false, createChangeEventDetails(REASONS.escapeKey));
      tick();
      await vi.waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(closeCount(onOpenChangeComplete)).toBe(1);

      actions?.unmount();
      actions?.unmount();
      tick();
      await nextFrames();
      expect(store.peek("mounted")).toBe(false);
      expect(closeCount(onOpenChangeComplete)).toBe(1);
    });

    it("stays mounted when unmounted while open and still closes afterwards", async () => {
      let actions: Select.Root.Actions | null = signal<Select.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const { store } = renderUnmountPopup({
        defaultOpen: true,
        actionsRef: (next) => {
          actions = next;
        },
        onOpenChangeComplete,
      });
      await nextFrames();

      // Matches upstream: unmounting while open runs the completion once without an
      // observable unmount (no focus return), and the later close completes closing again.
      actions?.unmount();
      tick();
      await nextFrames();
      expect(store.peek("open")).toBe(true);
      expect(screen.queryByRole("listbox")).not.toBeNull();

      store.context.setOpen(false, createChangeEventDetails(REASONS.escapeKey));
      tick();
      await vi.waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(closeCount(onOpenChangeComplete)).toBe(2);
    });

    it("closes the popup through the close action", async () => {
      let actions: Select.Root.Actions | null = signal<Select.Root.Actions | null>(null);
      const onOpenChange = vi.fn();
      const { store } = renderUnmountPopup({
        defaultOpen: true,
        actionsRef: (next) => {
          actions = next;
        },
        onOpenChange,
      });
      await nextFrames();

      actions?.close();
      tick();
      await vi.waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

      expect(store.peek("open")).toBe(false);
      expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: REASONS.imperativeAction }));
    });
  });
});

function ReadonlyMultipleValues() {
  function Test() {
    let value = signal<string[]>([]);
    const tupleValue = ["javascript", "typescript"] as const;

    return (
      <>
        <Select.Root
          multiple
          value={value as readonly string[]}
          onValueChange={(next) => {
            value = next;
          }}
        />
        <Select.Root
          multiple
          defaultValue={value as readonly string[]}
          onValueChange={(next) => {
            value = next;
          }}
        />
        <Select.Root
          multiple
          value={tupleValue}
          onValueChange={(newValue) => {
            const checked: ("javascript" | "typescript")[] = newValue;
            checked.pop();
          }}
        />
        <Select.Root
          multiple
          defaultValue={tupleValue}
          onValueChange={(next) => {
            value = [...next];
          }}
        />
      </>
    );
  }
  return <Test />;
}

void ReadonlyMultipleValues;

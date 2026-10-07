import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { nextFrames } from "#test-utils";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import * as Select from "../index.parts";
import type { SelectStore } from "../store/SelectStore";
import { useSelectRootContext, useSelectRootPropsContext } from "./SelectRootContext";

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

function renderSelect(options?: { rootProps?: Record<string, any>; children?: any; onStore?: (store: SelectStore) => void }) {
  const { rootProps = {}, children = "content", onStore } = options ?? {};
  const result = render(() => (
    <Select.Root {...rootProps}>
      {onStore ? <CaptureStore onStore={onStore} /> : null}
      {children}
    </Select.Root>
  ));
  flush();
  return result;
}

describe("<Select.Root />", () => {
  it("renders children and a hidden input carrying the serialized value", () => {
    const { container } = renderSelect({
      rootProps: { name: "font", defaultValue: "serif" },
    });

    expect(screen.getByText("content")).toBeInTheDocument();

    const input = container.querySelector("input") as HTMLInputElement;
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
    flush();

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
    flush();

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
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe(REASONS.triggerPress);
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
    let captured: SelectStore | undefined;
    renderSelect({
      rootProps: { onOpenChange },
      onStore: (store) => {
        captured = store;
      },
    });

    captured?.context.setOpen(true, createChangeEventDetails(REASONS.triggerPress));
    flush();

    expect(captured?.peek("open")).toBe(false);
  });

  it("syncs a controlled value prop into the store", async () => {
    const [value, setValue] = createSignal<any>("sans");
    let captured: SelectStore | undefined;
    const { container } = render(() => (
      <Select.Root value={value()} onValueChange={(next) => setValue(next)}>
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
      </Select.Root>
    ));
    flush();
    await nextFrames();

    expect(captured?.peek("value")).toBe("sans");

    setValue("serif");
    flush();
    await nextFrames();

    expect(captured?.peek("value")).toBe("serif");
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("serif");
  });

  it("supports a controlled open prop", async () => {
    const [open, setOpen] = createSignal(false);
    let captured: SelectStore | undefined;
    render(() => (
      <Select.Root open={open()} onOpenChange={(next) => setOpen(next)}>
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
      </Select.Root>
    ));
    flush();
    await nextFrames();

    expect(captured?.peek("open")).toBe(false);

    setOpen(true);
    flush();
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
    const { container } = renderSelect({
      rootProps: { name: "fonts", multiple: true, defaultValue: ["sans", "serif"] },
    });

    const inputs = Array.from(container.querySelectorAll('input[type="hidden"]'));
    expect(inputs.map((input) => (input as HTMLInputElement).value).sort()).toEqual(["sans", "serif"]);
    expect(inputs.every((input) => (input as HTMLInputElement).name === "fonts")).toBe(true);

    // The shared input stays nameless so only per-value entries are submitted.
    const shared = container.querySelector("input:not([type])") as HTMLInputElement;
    expect(shared.name).toBe("");
  });

  it("serializes object values with itemToStringValue for form submission", () => {
    const { container } = renderSelect({
      rootProps: {
        name: "font",
        defaultValue: { id: "sans", label: "Sans" },
        itemToStringValue: (item: { id: string }) => item.id,
      },
    });

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("sans");
  });

  it("publishes disabled and readOnly through the props context", () => {
    let disabledValue = false;
    let readOnlyValue = false;
    function CaptureProps() {
      const propsContext = useSelectRootPropsContext();
      disabledValue = propsContext.disabled;
      readOnlyValue = propsContext.readOnly;
      return null;
    }

    render(() => (
      <Select.Root disabled readOnly>
        <CaptureProps />
      </Select.Root>
    ));
    flush();

    expect(disabledValue).toBe(true);
    expect(readOnlyValue).toBe(true);
  });

  it("disables the hidden input when disabled", () => {
    const { container } = renderSelect({
      rootProps: { name: "font", disabled: true },
    });

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("moves DOM focus alongside the highlight on arrow keys", async () => {
    let captured: SelectStore | undefined;
    render(() => (
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
    flush();
    await nextFrames();

    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    flush();
    await nextFrames();

    const optionA = screen.getByRole("option", { name: "a" });
    const optionB = screen.getByRole("option", { name: "b" });
    expect(captured?.peek("open")).toBe(true);
    expect(optionA).toHaveAttribute("data-highlighted", "");
    expect(document.activeElement).toBe(optionA);

    // ArrowDown advances n+1 instead of resetting to the first item …
    fireEvent.keyDown(optionA, { key: "ArrowDown" });
    flush();
    expect(optionB).toHaveAttribute("data-highlighted", "");
    expect(document.activeElement).toBe(optionB);

    // … and ArrowUp advances n-1 instead of jumping to the last item.
    fireEvent.keyDown(optionB, { key: "ArrowUp" });
    flush();
    expect(optionA).toHaveAttribute("data-highlighted", "");
    expect(document.activeElement).toBe(optionA);
  });

  it("records a touch openMethod from pointerdown when the click carries no pointerType", () => {
    let captured: SelectStore | undefined;
    render(() => (
      <Select.Root>
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
        <Select.Trigger data-testid="trigger">Trigger</Select.Trigger>
      </Select.Root>
    ));
    flush();

    const trigger = screen.getByTestId("trigger");
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    // Safari/Firefox deliver a plain MouseEvent to click handlers.
    fireEvent.click(trigger, { detail: 1 });
    flush();

    expect(captured?.peek("openMethod")).toBe("touch");
  });

  it("delivers unmount through actionsRef after the popup closes", async () => {
    const [actions, setActions] = createSignal<Select.Root.Actions | null>(null);
    let captured: SelectStore | undefined;
    render(() => (
      <Select.Root actionsRef={setActions} defaultOpen>
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
      </Select.Root>
    ));
    flush();
    await nextFrames();

    expect(actions()).not.toBeNull();
    expect(captured?.peek("open")).toBe(true);
    expect(captured?.peek("mounted")).toBe(true);

    captured?.context.setOpen(false, createChangeEventDetails(REASONS.escapeKey));
    flush();
    await nextFrames();
    actions()?.unmount();
    flush();
    await nextFrames();

    expect(captured?.peek("mounted")).toBe(false);
  });
});

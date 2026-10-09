import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as AlertDialog from "../index.parts";

function renderAlertDialog(rootProps: AlertDialog.Root.Props = {}) {
  render(() => (
    <AlertDialog.Root {...rootProps}>
      <AlertDialog.Trigger>Open alert</AlertDialog.Trigger>
      <button type="button">Outside</button>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop data-testid="backdrop" />
        <AlertDialog.Popup data-testid="popup">
          <AlertDialog.Title>Alert title</AlertDialog.Title>
          <AlertDialog.Description>Alert description</AlertDialog.Description>
          <AlertDialog.Close>Close alert</AlertDialog.Close>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  ));

  return {
    trigger: screen.getByRole("button", { name: "Open alert" }),
    outside: screen.getByRole("button", { name: "Outside" }),
    popup: () => screen.queryByTestId("popup"),
  };
}

async function openViaTrigger(trigger: HTMLElement) {
  const user = userEvent.setup();
  await user.click(trigger);
  flush();
  await nextFrames();
  return user;
}

describe("<AlertDialog.Root />", () => {
  it("opens with the alertdialog role and modal semantics", async () => {
    const { trigger, popup } = renderAlertDialog();

    await openViaTrigger(trigger);

    const popupElement = popup()!;
    expect(popupElement).toBeInTheDocument();
    expect(popupElement).toHaveAttribute("role", "alertdialog");
    expect(popupElement).toHaveAttribute("aria-modal", "true");

    const labelledBy = popupElement.getAttribute("aria-labelledby");
    const describedBy = popupElement.getAttribute("aria-describedby");
    expect(document.getElementById(labelledBy!)).toHaveTextContent("Alert title");
    expect(document.getElementById(describedBy!)).toHaveTextContent("Alert description");
  });

  it("closes when the close button is clicked", async () => {
    const { trigger, popup } = renderAlertDialog();

    await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close alert" }));
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
  });

  it("never closes on outside press", async () => {
    const onOpenChange = vi.fn();
    const { trigger, outside, popup } = renderAlertDialog({ onOpenChange });

    await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(outside);
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false, expect.anything());
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderAlertDialog({ onOpenChange });

    const user = await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    await user.keyboard("{Escape}");
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape-key" }));
  });

  it("traps focus and locks scroll while open", async () => {
    const { trigger, popup } = renderAlertDialog();

    await openViaTrigger(trigger);

    expect(popup()).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe("hidden");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close alert" }));
    flush();
    await nextFrames();

    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

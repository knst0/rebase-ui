import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Dialog from "../index.parts";
import * as DialogPopupDataAttributes from "./DialogPopupDataAttributes";

function renderDialog(rootProps: Dialog.Root.Props = {}, popupProps: Dialog.Popup.Props = {}) {
  render(() => (
    <Dialog.Root {...rootProps}>
      <Dialog.Trigger>Open dialog</Dialog.Trigger>
      <button type="button">Outside</button>
      <Dialog.Portal>
        <Dialog.Viewport data-testid="viewport">
          <Dialog.Popup {...popupProps} data-testid="popup">
            <Dialog.Title>Dialog title</Dialog.Title>
            <Dialog.Description>Dialog description</Dialog.Description>
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  ));

  return {
    trigger: screen.getByRole("button", { name: "Open dialog" }),
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

describe("<Dialog.Popup />", () => {
  it("sets role, aria-modal, and title/description labelling", async () => {
    const { trigger, popup } = renderDialog();

    await openViaTrigger(trigger);

    const popupElement = popup()!;
    expect(popupElement).toHaveAttribute("role", "dialog");
    expect(popupElement).toHaveAttribute("aria-modal", "true");

    const labelledBy = popupElement.getAttribute("aria-labelledby");
    const describedBy = popupElement.getAttribute("aria-describedby");
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent("Dialog title");
    expect(document.getElementById(describedBy!)).toHaveTextContent("Dialog description");
  });

  it("traps focus and locks scroll while modal", async () => {
    const { trigger, popup } = renderDialog();

    await openViaTrigger(trigger);

    expect(popup()).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe("hidden");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    flush();
    await nextFrames();

    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("does not lock scroll for non-modal dialogs", async () => {
    const { trigger, popup } = renderDialog({ modal: false });

    await openViaTrigger(trigger);

    expect(popup()).toBeInTheDocument();
    expect(popup()).not.toHaveAttribute("aria-modal");
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("traps focus without locking scroll for `trap-focus` modals", async () => {
    const { trigger, popup } = renderDialog({ modal: "trap-focus" });

    await openViaTrigger(trigger);

    expect(popup()).toContainElement(document.activeElement as HTMLElement);
    expect(popup()).toHaveAttribute("aria-modal", "true");
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("keeps the popup in the DOM with `keepMounted` and hides it when closed", async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal keepMounted>
          <Dialog.Popup keepMounted data-testid="popup">
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const popup = () => screen.queryByTestId("popup");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(popup()).not.toHaveAttribute("hidden");

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(popup()).toHaveAttribute("hidden");
    expect(popup()).toHaveAttribute(DialogPopupDataAttributes.closed, "");
  });

  it("uses `hidden=until-found` when `hiddenUntilFound` is set", async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal keepMounted>
          <Dialog.Popup hiddenUntilFound keepMounted data-testid="popup">
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const popup = () => screen.queryByTestId("popup");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    flush();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(popup()).toHaveAttribute("hidden", "until-found");
  });
});

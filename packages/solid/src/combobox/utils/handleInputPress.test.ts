import { describe, expect, it, vi } from "vitest";

import type { ComboboxStore } from "../store/ComboboxStore";
import { handleInputPress } from "./handleInputPress";

function createStore(
  overrides: {
    openOnInputClick?: boolean;
    setOpen?: (...args: Array<any>) => void;
  } = {},
) {
  const focus = vi.fn();
  const setOpen = vi.fn();
  const store = {
    peekState: () => ({ openOnInputClick: overrides.openOnInputClick ?? false }),
    context: {
      inputRef: { current: { focus } },
      setOpen: overrides.setOpen ?? setOpen,
    },
  } as unknown as ComboboxStore;
  return { store, focus, setOpen };
}

function createMouseEvent(currentTarget: Element, target: EventTarget | null = currentTarget) {
  const event = {
    currentTarget,
    target,
    composedPath: () => (target ? [target] : []),
    preventDefault: vi.fn(),
  } as unknown as MouseEvent & { rebaseUIHandlerPrevented?: boolean | undefined };
  return event;
}
describe("handleInputPress", () => {
  it("handles an event whose target is not an Element", () => {
    const { store, focus } = createStore();
    const currentTarget = document.createElement("div");
    const event = createMouseEvent(currentTarget, document.createTextNode("padding"));

    handleInputPress(event, store, false);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });

  it("focuses the input and opens the popup when openOnInputClick is set", () => {
    const { store, focus, setOpen } = createStore({ openOnInputClick: true });
    const currentTarget = document.createElement("div");
    const event = createMouseEvent(currentTarget);

    handleInputPress(event, store, false);

    expect(focus).toHaveBeenCalledOnce();
    expect(setOpen).toHaveBeenCalledOnce();
    expect(setOpen.mock.calls[0]?.[0]).toBe(true);
  });

  it("does not open the popup when openOnInputClick is not set", () => {
    const { store, focus, setOpen } = createStore({ openOnInputClick: false });
    const currentTarget = document.createElement("div");

    handleInputPress(createMouseEvent(currentTarget), store, false);

    expect(focus).toHaveBeenCalledOnce();
    expect(setOpen).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const { store, focus, setOpen } = createStore({ openOnInputClick: true });
    const currentTarget = document.createElement("div");

    handleInputPress(createMouseEvent(currentTarget), store, true);

    expect(focus).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
  });

  it("ignores presses on interactive targets inside the container", () => {
    const { store, focus } = createStore();
    const currentTarget = document.createElement("div");
    const button = document.createElement("button");
    currentTarget.append(button);

    handleInputPress(createMouseEvent(currentTarget, button), store, false);

    expect(focus).not.toHaveBeenCalled();
  });

  it("ignores events already handled by another handler", () => {
    const { store, focus } = createStore();
    const currentTarget = document.createElement("div");
    const event = createMouseEvent(currentTarget);
    event.rebaseUIHandlerPrevented = true;

    handleInputPress(event, store, false);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });
});

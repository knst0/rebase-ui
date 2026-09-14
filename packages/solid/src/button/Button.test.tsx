import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { describeConformance } from "#test-utils";

import { Button } from "./Button";
import * as ButtonDataAttributes from "./ButtonDataAttributes";

describe("<Button />", () => {
  describe("native button", () => {
    describeConformance((props) => <Button {...props} />, {
      defaultElement: "button",
      refInstanceof: window.HTMLButtonElement,
    });
  });

  describe("non-native button", () => {
    describeConformance((props) => <Button nativeButton={false} as="span" {...props} />, {
      defaultElement: "span",
      as: { targetElement: "section" },
      refInstanceof: window.HTMLSpanElement,
    });
  });

  it("defaults the native button type to button", () => {
    render(() => <Button>Submit</Button>);

    expect(screen.getByRole("button", { name: "Submit" })).toHaveAttribute("type", "button");
  });

  describe("prop: nativeButton", () => {
    it("custom link element: Space activates the link without scrolling the page", async () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();

      const user = userEvent.setup();
      render(() => (
        <Button as="a" nativeButton={false} onClick={handleClick} onKeyDown={handleKeyDown}>
          Go
        </Button>
      ));

      const link = screen.getByRole("button", { name: "Go" });
      expect(link.tagName).toBe("A");

      link.focus();
      await user.keyboard("[Space]");

      expect(handleKeyDown).toHaveBeenCalled();
      expect(handleKeyDown.mock.calls[0][0].defaultPrevented).toBe(true);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("custom element: applies button semantics and dispatches real clicks from keyboard activation", async () => {
      const handleClick = vi.fn();
      const handleAncestorClick = vi.fn();

      const user = userEvent.setup();
      render(() => (
        <div onClick={handleAncestorClick}>
          <Button as="span" nativeButton={false} onClick={handleClick}>
            Save
          </Button>
        </div>
      ));

      const button = screen.getByRole("button", { name: "Save" });

      expect(button.tagName).toBe("SPAN");
      expect(button.getAttribute("role")).toBe("button");
      expect(button.getAttribute("tabindex")).toBe("0");

      button.focus();
      await user.keyboard("[Enter]");
      await user.keyboard("[Space]");

      expect(handleClick).toHaveBeenCalledTimes(2);
      expect(handleAncestorClick).toHaveBeenCalledTimes(2);
    });

    it("custom element: keyboard activation clicks carry modifier key state", async () => {
      const handleClick = vi.fn();

      const user = userEvent.setup();
      render(() => (
        <Button as="span" nativeButton={false} onClick={handleClick}>
          Save
        </Button>
      ));

      const button = screen.getByRole("button", { name: "Save" });

      button.focus();
      await user.keyboard("{Shift>}[Enter]{/Shift}");

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick.mock.calls[0][0].shiftKey).toBe(true);
    });
  });

  describe("prop: disabled", () => {
    it("native button: uses the disabled attribute and is not focusable", async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      const user = userEvent.setup();
      render(() => (
        <Button disabled onClick={handleClick} onMouseDown={handleMouseDown} onPointerDown={handlePointerDown} onKeyDown={handleKeyDown} />
      ));

      const button = screen.getByRole("button");

      expect(button.hasAttribute("disabled")).toBe(true);
      expect(button.hasAttribute(ButtonDataAttributes.disabled)).toBe(true);
      expect(button.hasAttribute("aria-disabled")).toBe(false);

      await user.click(button);
      await user.keyboard("[Enter]");
      await user.keyboard("[Space]");

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleMouseDown).not.toHaveBeenCalled();
      expect(handlePointerDown).not.toHaveBeenCalled();
      expect(handleKeyDown).not.toHaveBeenCalled();
    });

    it("custom element: applies aria-disabled and is not focusable", async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      const user = userEvent.setup();
      render(() => (
        <Button
          disabled
          nativeButton={false}
          as="span"
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        />
      ));

      const button = screen.getByRole("button");

      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.hasAttribute(ButtonDataAttributes.disabled)).toBe(true);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("tabindex")).toBe("-1");

      await user.click(button);
      await user.keyboard("[Enter]");
      await user.keyboard("[Space]");

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleMouseDown).not.toHaveBeenCalled();
      expect(handlePointerDown).not.toHaveBeenCalled();
      expect(handleKeyDown).not.toHaveBeenCalled();
    });
  });

  describe("prop: focusableWhenDisabled", () => {
    it("native button: prevents interactions but remains focusable", async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      const user = userEvent.setup();
      render(() => (
        <Button
          disabled
          focusableWhenDisabled
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        />
      ));

      const button = screen.getByRole("button");

      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.hasAttribute(ButtonDataAttributes.disabled)).toBe(true);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("tabindex")).toBe("0");

      button.focus();
      await user.click(button);
      await user.keyboard("[Enter]");
      await user.keyboard("[Space]");

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleMouseDown).not.toHaveBeenCalled();
      expect(handlePointerDown).not.toHaveBeenCalled();
      expect(handleKeyDown).not.toHaveBeenCalled();
    });

    it("keeps focus and suppresses interactions after becoming disabled", async () => {
      const handleClick = vi.fn();

      function TestButton() {
        const [disabled, setDisabled] = createSignal(false);

        return (
          <Button
            disabled={disabled()}
            focusableWhenDisabled
            onClick={(event: MouseEvent) => {
              handleClick(event);
              setDisabled(true);
            }}
          >
            Save
          </Button>
        );
      }

      const user = userEvent.setup();
      render(() => <TestButton />);

      const button = screen.getByRole("button", { name: "Save" });

      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(button.getAttribute("aria-disabled")).toBe("true");

      button.focus();
      await user.click(button);
      await user.keyboard("[Enter]");
      await user.keyboard("[Space]");

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("reacts to focusableWhenDisabled changes after mount", async () => {
      function TestButton() {
        const [focusable, setFocusable] = createSignal(false);

        return (
          <>
            <Button disabled focusableWhenDisabled={focusable()}>
              Save
            </Button>
            <button type="button" onClick={() => setFocusable(true)}>
              Make focusable
            </button>
          </>
        );
      }

      const user = userEvent.setup();
      render(() => <TestButton />);

      const button = screen.getByRole("button", { name: "Save" });
      expect(button.hasAttribute("disabled")).toBe(true);

      await user.click(screen.getByRole("button", { name: "Make focusable" }));

      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("tabindex")).toBe("0");
    });

    it("custom element: prevents interactions but remains focusable", async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      const user = userEvent.setup();
      render(() => (
        <Button
          disabled
          focusableWhenDisabled
          nativeButton={false}
          as="span"
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        />
      ));

      const button = screen.getByRole("button");

      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.hasAttribute(ButtonDataAttributes.disabled)).toBe(true);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("tabindex")).toBe("0");

      button.focus();
      await user.click(button);
      await user.keyboard("[Enter]");
      await user.keyboard("[Space]");

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleMouseDown).not.toHaveBeenCalled();
      expect(handlePointerDown).not.toHaveBeenCalled();
      expect(handleKeyDown).not.toHaveBeenCalled();
    });
  });
});

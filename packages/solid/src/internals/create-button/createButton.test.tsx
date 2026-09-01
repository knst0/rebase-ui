import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, render } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import type { JSX } from "@solidjs/web";
import { flush, omit } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isJSDOM } from "#test-utils";

import type { RebaseUIEvent } from "../../types";
import { CompositeRoot } from "../composite";
import { mergeRefs } from "../mergeRefs";
import { createButton } from "./createButton";
import type { GenericButtonProps } from "./createButton";

describe("useButton", () => {
  const focusElement = async (element: HTMLElement) => {
    flush();
    element.focus();
  };

  describe("non-native button", () => {
    describe("keyboard interactions", () => {
      ["Enter", "Space"].forEach((key) => {
        it(`can be activated with ${key} key`, async () => {
          const clickSpy = vi.fn();

          function Button(props: JSX.IntrinsicElements["span"]) {
            const { getButtonProps } = createButton({
              native: false,
            });

            return <span {...getButtonProps(props)} />;
          }

          const user = userEvent.setup();
          render(() => <Button onClick={clickSpy} />);

          const button = screen.getByRole("button");

          await user.keyboard("[Tab]");
          expect(button).toHaveFocus();

          await user.keyboard(`[${key}]`);
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      });

      it("does not set a type prop", () => {
        let buttonProps: GenericButtonProps | undefined;

        function Button() {
          const { getButtonProps } = createButton({ native: false });
          buttonProps = getButtonProps();
          return <span {...buttonProps} />;
        }

        render(() => <Button />);
        expect("type" in (buttonProps as GenericButtonProps)).toBe(false);
      });

      it.skipIf(isJSDOM)("can be activated with Enter when the keyboard event originates inside a shadow root", async () => {
        const clickSpy = vi.fn();

        function Button(props: JSX.IntrinsicElements["span"]) {
          const { getButtonProps, buttonRef } = createButton({
            native: false,
          });
          const handleRef = (node: HTMLSpanElement | null) => {
            buttonRef(node);

            if (!node || node.shadowRoot) {
              return;
            }

            const shadowRoot = node.attachShadow({ mode: "open" });
            const inner = document.createElement("span");
            inner.tabIndex = 0;
            shadowRoot.appendChild(inner);
          };

          return <span {...getButtonProps({ ...props, ref: handleRef })} />;
        }

        render(() => <Button onClick={clickSpy} />);

        const host = screen.getByRole("button");
        const inner = host.shadowRoot?.querySelector("span");

        expect(inner).toBeTruthy();

        if (!inner) {
          return;
        }

        (inner as HTMLElement).focus();

        inner.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            composed: true,
          }),
        );

        expect(clickSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("param: focusableWhenDisabled", () => {
    it("allows disabled buttons to be focused", async () => {
      function TestButton(props: JSX.IntrinsicElements["button"]) {
        const disabled = () => props.disabled !== undefined && props.disabled !== false;
        const otherProps = omit(props, "disabled");
        const { getButtonProps } = createButton({
          disabled,
          focusableWhenDisabled: true,
        });

        return <button {...getButtonProps(otherProps)} />;
      }
      render(() => <TestButton disabled />);
      const button = screen.getByRole("button");
      await focusElement(button);
      expect(button).toHaveFocus();
    });

    it("force overrides disabled attribute when put in a composite", async () => {
      function TestButton(_props: { buttonKey?: string }) {
        const { getButtonProps, buttonRef } = createButton({
          disabled: true,
          focusableWhenDisabled: true,
        });

        return <button ref={buttonRef} {...getButtonProps({ disabled: true })} />;
      }

      render(() => (
        <CompositeRoot>
          <TestButton />
        </CompositeRoot>
      ));

      async function verify() {
        const button = screen.getByRole("button");
        await focusElement(button);
        expect(button).toHaveFocus();
      }

      await verify();

      cleanup();
      render(() => (
        <CompositeRoot>
          <TestButton buttonKey="rerender" />
        </CompositeRoot>
      ));
      await verify();
    });

    it("prevents interactions except focus and blur", async () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["button"]) {
        const disabled = () => props.disabled !== undefined && props.disabled !== false;
        const otherProps = omit(props, "disabled");
        const { getButtonProps } = createButton({
          disabled,
          focusableWhenDisabled: true,
          native: false,
        });

        return <span {...getButtonProps(otherProps)} />;
      }

      const user = userEvent.setup();
      render(() => (
        <TestButton
          disabled
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      ));

      const button = screen.getByRole("button");
      expect(document.activeElement).not.toBe(button);

      expect(handleFocus).toHaveBeenCalledTimes(0);
      await user.keyboard("[Tab]");
      expect(button).toHaveFocus();
      expect(handleFocus).toHaveBeenCalledTimes(1);

      await user.keyboard("[Enter]");
      expect(handleKeyDown).toHaveBeenCalledTimes(0);
      expect(handleClick).toHaveBeenCalledTimes(0);

      await user.keyboard("[Space]");
      expect(handleKeyUp).toHaveBeenCalledTimes(0);
      expect(handleClick).toHaveBeenCalledTimes(0);

      await user.click(button);
      expect(handleKeyDown).toHaveBeenCalledTimes(0);
      expect(handleKeyUp).toHaveBeenCalledTimes(0);
      expect(handleClick).toHaveBeenCalledTimes(0);

      expect(handleBlur).toHaveBeenCalledTimes(0);
      await user.keyboard("[Tab]");
      expect(handleBlur).toHaveBeenCalledTimes(1);
      expect(document.activeElement).not.toBe(button);
    });
  });

  describe("param: tabIndex", () => {
    it("returns tabIndex in getButtonProps when host component is BUTTON", () => {
      function TestButton() {
        const { getButtonProps } = createButton();

        expect(getButtonProps().tabIndex).toBe(0);

        return <button {...getButtonProps()} />;
      }

      render(() => <TestButton />);
      expect(screen.getByRole("button")).toHaveProperty("tabIndex", 0);
    });

    it("returns tabIndex in getButtonProps when host component is not BUTTON", () => {
      function TestButton() {
        let ref: HTMLSpanElement | null = null;
        const { getButtonProps, buttonRef } = createButton({ native: false });
        mergeRefs(ref, buttonRef);

        expect(getButtonProps().tabIndex).toBe(0);

        return <span {...getButtonProps()} />;
      }

      render(() => <TestButton />);
      expect(screen.getByRole("button")).toHaveProperty("tabIndex", 0);
    });

    it("returns tabIndex in getButtonProps if it is explicitly provided", () => {
      const customTabIndex = 3;
      function TestButton() {
        const { getButtonProps } = createButton({ tabIndex: customTabIndex });
        return <button {...getButtonProps()} />;
      }

      render(() => <TestButton />);
      expect(screen.getByRole("button")).toHaveProperty("tabIndex", customTabIndex);
    });
  });

  describe("arbitrary props", () => {
    it("are passed to the host component", () => {
      const buttonTestId = "button-test-id";
      function TestButton() {
        const { getButtonProps } = createButton();
        return <button {...getButtonProps({ "data-testid": buttonTestId })} />;
      }

      render(() => <TestButton />);
      expect(screen.getByRole("button")).toHaveAttribute("data-testid", buttonTestId);
    });
  });

  describe("event handlers", () => {
    it("key: Space fires keyup then click on non-composite buttons", async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["span"]) {
        const { getButtonProps } = createButton({ native: false });

        return <span {...getButtonProps(props)} />;
      }

      render(() => <TestButton onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick} />);

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: " " });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(0);

      fireEvent.keyUp(button, { key: " " });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("key: Space fires keydown then click on composite buttons", async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["span"]) {
        const { getButtonProps } = createButton({ native: false, composite: true });

        return <span {...getButtonProps(props)} />;
      }

      render(() => <TestButton tabindex={0} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick} />);

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: " " });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: " " });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("key: Space fires keydown then click on composite links", async () => {
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["a"]) {
        const { getButtonProps } = createButton({ native: false, composite: true });

        return <a href="#test" {...getButtonProps(props)} />;
      }

      render(() => <TestButton onClick={handleClick} />);

      const link = screen.getByRole("button");

      await focusElement(link);
      expect(link).toHaveFocus();

      fireEvent.keyDown(link, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(link, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not click composite links when Space is prevented for text navigation", async () => {
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["a"]) {
        const { getButtonProps } = createButton({ native: false, composite: true });

        return <a href="#test" {...getButtonProps({ role: "menuitem", ...props })} />;
      }

      render(() => <TestButton onKeyDown={(event) => event.preventDefault()} onClick={handleClick} />);

      const link = screen.getByRole("menuitem");

      await focusElement(link);
      expect(link).toHaveFocus();

      fireEvent.keyDown(link, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it("does not click composite gridcells when Space is prevented", async () => {
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["div"]) {
        const { getButtonProps } = createButton({ native: false, composite: true });

        return <div {...getButtonProps({ role: "gridcell", tabIndex: 0, ...props })} />;
      }

      render(() => <TestButton onKeyDown={(event) => event.preventDefault()} onClick={handleClick} />);

      const gridcell = screen.getByRole("gridcell");

      await focusElement(gridcell);
      expect(gridcell).toHaveFocus();

      fireEvent.keyDown(gridcell, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it("clicks composite switches when Space is prevented", async () => {
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["div"]) {
        const { getButtonProps } = createButton({ native: false, composite: true });

        return <div {...getButtonProps({ role: "switch", tabIndex: 0, ...props })} />;
      }

      render(() => <TestButton onKeyDown={(event) => event.preventDefault()} onClick={handleClick} />);

      const switchElement = screen.getByRole("switch");

      await focusElement(switchElement);
      expect(switchElement).toHaveFocus();

      fireEvent.keyDown(switchElement, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("key: Space fires keydown then click on native composite buttons", async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["button"]) {
        const { getButtonProps } = createButton({ composite: true });

        return <button {...getButtonProps(props)} />;
      }

      render(() => <TestButton onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick} />);

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: " " });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: " " });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not fire duplicate clicks for Space on native composite buttons", async () => {
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["button"]) {
        const { getButtonProps } = createButton({ composite: true });

        return <button {...getButtonProps(props)} />;
      }

      const user = userEvent.setup();
      render(() => <TestButton onClick={handleClick} />);

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      await user.keyboard("[Space]");
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("fires a single click for nested non-native composite buttons", async () => {
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["span"]) {
        const outer = createButton({ native: false, composite: true });
        const inner = createButton({ native: false, composite: true });

        return <span {...outer.getButtonProps(inner.getButtonProps(props))} />;
      }

      const user = userEvent.setup();
      render(() => <TestButton tabindex={0} onClick={handleClick} />);

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      await user.keyboard("[Space]");
      expect(handleClick).toHaveBeenCalledTimes(1);

      await user.keyboard("[Enter]");
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it("key: Space preserves native submit semantics on composite buttons", async () => {
      const handleSubmit = vi.fn((event: Event) => {
        event.preventDefault();
      });

      function TestButton() {
        const { getButtonProps } = createButton({ composite: true });

        return (
          <form onSubmit={handleSubmit}>
            <button {...getButtonProps({ type: "submit" })}>Submit</button>
          </form>
        );
      }

      render(() => <TestButton />);

      const button = screen.getByRole("button", { name: "Submit" });

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: " " });
      expect(handleSubmit).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: " " });
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it("key: Space preserves native reset semantics on composite buttons", async () => {
      const handleReset = vi.fn((event: Event) => {
        event.preventDefault();
      });

      function TestButton() {
        const { getButtonProps } = createButton({ composite: true });

        return (
          <form onReset={handleReset}>
            <button {...getButtonProps({ type: "reset" })}>Reset</button>
          </form>
        );
      }

      render(() => <TestButton />);

      const button = screen.getByRole("button", { name: "Reset" });

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: " " });
      expect(handleReset).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: " " });
      expect(handleReset).toHaveBeenCalledTimes(1);
    });

    it("does not click composite buttons when keydown calls preventRebaseUIHandler", async () => {
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["span"]) {
        const { getButtonProps } = createButton({ native: false, composite: true });

        return <span {...getButtonProps(props)} />;
      }

      render(() => (
        <TestButton
          tabindex={0}
          onKeyDown={(event) => (event as unknown as RebaseUIEvent<KeyboardEvent>).preventRebaseUIHandler()}
          onClick={handleClick}
        />
      ));

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it("does not click non-composite buttons when keydown/keyup calls preventRebaseUIHandler", async () => {
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["span"]) {
        const { getButtonProps } = createButton({ native: false });

        return <span {...getButtonProps(props)} />;
      }

      const preventRebaseUIHandler = (event: any) => (event as RebaseUIEvent<Event>).preventRebaseUIHandler();

      render(() => <TestButton tabindex={0} onKeyDown={preventRebaseUIHandler} onKeyUp={preventRebaseUIHandler} onClick={handleClick} />);

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: "Enter" });
      expect(handleClick).toHaveBeenCalledTimes(0);

      fireEvent.keyDown(button, { key: " " });
      fireEvent.keyUp(button, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it("key: Enter does not click non-native buttons when keydown calls preventDefault", async () => {
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["span"]) {
        const { getButtonProps } = createButton({ native: false });

        return <span {...getButtonProps(props)} />;
      }

      const user = userEvent.setup();
      render(() => <TestButton tabindex={0} onKeyDown={(event) => event.preventDefault()} onClick={handleClick} />);

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      await user.keyboard("[Enter]");
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it("key: Space does not click non-native buttons when keyup calls preventDefault", async () => {
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["span"]) {
        const { getButtonProps } = createButton({ native: false });

        return <span {...getButtonProps(props)} />;
      }

      const user = userEvent.setup();
      render(() => <TestButton tabindex={0} onKeyUp={(event) => event.preventDefault()} onClick={handleClick} />);

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      await user.keyboard("[Space]");
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it("key: Space fires keydown then click when in composite root context", async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["span"]) {
        const { getButtonProps } = createButton({ native: false });

        return <span {...getButtonProps(props)} />;
      }

      render(() => (
        <CompositeRoot>
          <TestButton tabindex={0} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick} />
        </CompositeRoot>
      ));

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: " " });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: " " });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("key: Space fires keydown then click on native buttons in composite root context", async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["button"]) {
        const { getButtonProps } = createButton();

        return <button {...getButtonProps(props)} />;
      }

      render(() => (
        <CompositeRoot>
          <TestButton onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick} />
        </CompositeRoot>
      ));

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: " " });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: " " });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("`composite=false` keeps keyup activation inside composite root context", async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["span"]) {
        const { getButtonProps } = createButton({ native: false, composite: false });

        return <span {...getButtonProps(props)} />;
      }

      render(() => (
        <CompositeRoot>
          <TestButton onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick} />
        </CompositeRoot>
      ));

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: " " });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(0);

      fireEvent.keyUp(button, { key: " " });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("key: Enter fires keydown then click on non-native buttons", async () => {
      const handleKeyDown = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: JSX.IntrinsicElements["span"]) {
        const { getButtonProps } = createButton({ native: false });

        return <span {...getButtonProps(props)} />;
      }

      render(() => <TestButton onKeyDown={handleKeyDown} onClick={handleClick} />);

      const button = screen.getByRole("button");

      await focusElement(button);
      expect(button).toHaveFocus();

      expect(handleKeyDown).toHaveBeenCalledTimes(0);
      fireEvent.keyDown(button, { key: "Enter" });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("rendered button attributes", () => {
    it("renders the button role on a non-native button", () => {
      function TestButton(props: JSX.IntrinsicElements["button"]) {
        const disabled = () => props.disabled !== undefined && props.disabled !== false;
        const otherProps = omit(props, "disabled");
        const { getButtonProps } = createButton({ disabled, native: false });

        return <span {...getButtonProps(otherProps)} />;
      }

      const { container } = render(() => <TestButton disabled />);

      expect(container.firstChild).toHaveProperty("role", "button");
    });

    it("adds disabled attribute", () => {
      function TestButton(props: JSX.IntrinsicElements["button"]) {
        const disabled = () => props.disabled !== undefined && props.disabled !== false;
        const otherProps = omit(props, "disabled");
        const { getButtonProps } = createButton({ disabled });
        return <button {...getButtonProps(otherProps)}>Submit</button>;
      }

      render(() => <TestButton disabled>Submit</TestButton>);
      expect(screen.getByRole("button")).toHaveProperty("disabled");
    });
  });

  describe("dev warnings", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });
    it("errors if nativeButton=true but ref is not a button", () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockName("console.error")
        .mockImplementation(() => {});
      function TestButton() {
        const { getButtonProps, buttonRef } = createButton({ native: true });
        return <span {...getButtonProps()} ref={buttonRef} />;
      }
      render(() => <TestButton />);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Rebase UI: A component that acts as a button expected a native <button> because " +
            "the `nativeButton` prop is true. Rendering a non-<button> removes native button semantics, " +
            "which can impact forms and accessibility. Use a real <button> in the `render` prop, or set " +
            "`nativeButton` to `false`.",
        ),
      );
    });

    it("errors if nativeButton=false but ref is a button", () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockName("console.error")
        .mockImplementation(() => {});
      function TestButton() {
        const { getButtonProps, buttonRef } = createButton({ native: false });
        return <button {...getButtonProps()} ref={buttonRef} />;
      }
      render(() => <TestButton />);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Rebase UI: A component that acts as a button expected a non-<button> because " +
            "the `nativeButton` prop is false. Rendering a <button> keeps native behavior while Rebase UI " +
            "applies non-native attributes and handlers, which can add unintended extra attributes " +
            "(such as `role` or `aria-disabled`). Use a non-<button> in the `render` prop, or set " +
            "`nativeButton` to `true`.",
        ),
      );
    });
  });
});

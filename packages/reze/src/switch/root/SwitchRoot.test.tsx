import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Field from "../../field/index.parts";
import { SwitchThumb } from "../thumb/SwitchThumb";
import { SwitchRoot } from "./SwitchRoot";
import * as SwitchRootDataAttributes from "./SwitchRootDataAttributes";

afterEach(cleanup);

describe("<Switch.Root />", () => {
  it("renders a span element by default", () => {
    mount(() => <SwitchRoot />);
    tick();

    expect(screen.getByRole("switch").tagName).toBe("SPAN");
  });

  it("renders the customized root element", () => {
    mount(() => <SwitchRoot as="div" />);
    tick();

    expect(screen.getByRole("switch").tagName).toBe("DIV");
  });

  it("renders with role switch and unchecked state", () => {
    mount(() => <SwitchRoot />);
    tick();

    const root = screen.getByRole("switch");
    expect(root).toHaveAttribute("aria-checked", "false");
    expect(root).toHaveAttribute(SwitchRootDataAttributes.unchecked, "");
    expect(root).not.toHaveAttribute(SwitchRootDataAttributes.checked);
  });

  it("toggles on click and calls onCheckedChange", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    mount(() => <SwitchRoot onCheckedChange={handleChange} />);
    tick();
    const root = screen.getByRole("switch");

    await user.click(root);
    tick();

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0]).toBe(true);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch")).toHaveAttribute(SwitchRootDataAttributes.checked, "");
  });

  it("respects defaultChecked and controlled checked", async () => {
    const user = userEvent.setup();
    mount(() => <SwitchRoot defaultChecked />);
    tick();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");

    const handleChange = vi.fn();
    mount(() => <SwitchRoot checked={false} onCheckedChange={handleChange} />);
    tick();
    const controlled = screen.getAllByRole("switch")[1];
    await user.click(controlled);
    tick();
    expect(handleChange).toHaveBeenCalledWith(true, expect.anything());
    expect(screen.getAllByRole("switch")[1]).toHaveAttribute("aria-checked", "false");
  });

  it("does not toggle when disabled or readOnly", async () => {
    const user = userEvent.setup();
    const handleDisabled = vi.fn();
    const handleReadOnly = vi.fn();
    mount(() => (
      <>
        <SwitchRoot disabled onCheckedChange={handleDisabled} data-testid="disabled-switch" />
        <SwitchRoot readOnly onCheckedChange={handleReadOnly} data-testid="readonly-switch" />
      </>
    ));
    tick();

    await user.click(screen.getByTestId("disabled-switch"));
    tick();
    await user.click(screen.getByTestId("readonly-switch"));
    tick();

    expect(handleDisabled).not.toHaveBeenCalled();
    expect(handleReadOnly).not.toHaveBeenCalled();
  });

  it("renders a hidden input for uncheckedValue when off", () => {
    mount(() => <SwitchRoot name="notifications" uncheckedValue="off" />);
    tick();

    const hidden = document.querySelector('input[type="hidden"][name="notifications"]') as HTMLInputElement | null;
    expect(hidden).not.toBe(null);
    expect(hidden?.value).toBe("off");
  });

  it("renders thumb inside root", () => {
    mount(() => (
      <SwitchRoot>
        <SwitchThumb data-testid="thumb" />
      </SwitchRoot>
    ));
    tick();

    expect(screen.getByTestId("thumb")).toBeInTheDocument();
  });

  it("forwards value and form to the hidden input instead of leaking them onto the root", () => {
    mount(() => <SwitchRoot data-testid="value-switch" name="notifications" value="yes" form="settings-form" />);
    tick();

    const root = screen.getByTestId("value-switch");
    expect(root).not.toHaveAttribute("value");
    expect(root).not.toHaveAttribute("form");

    const input = root.parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(input).not.toBe(null);
    expect(input?.value).toBe("yes");
    expect(input?.getAttribute("form")).toBe("settings-form");
    expect(input?.getAttribute("name")).toBe("notifications");
  });

  it("forwards form to the hidden uncheckedValue input", () => {
    mount(() => <SwitchRoot data-testid="form-switch" name="alerts" uncheckedValue="off" form="settings-form" />);
    tick();

    const hidden = screen.getByTestId("form-switch").parentElement?.querySelector('input[type="hidden"]') as HTMLInputElement | null;
    expect(hidden).not.toBe(null);
    expect(hidden?.value).toBe("off");
    expect(hidden?.getAttribute("form")).toBe("settings-form");
    expect(hidden?.getAttribute("name")).toBe("alerts");
  });

  it("prefers `aria-label` over an associated label", () => {
    mount(() => (
      <>
        <label>
          <SwitchRoot aria-label="Wi-Fi" />
          Wi-Fi
        </label>
        <Field.Root>
          <Field.Label>
            <SwitchRoot aria-label="Bluetooth" />
            Bluetooth
          </Field.Label>
        </Field.Root>
      </>
    ));
    tick();

    const [nativeLabelled, fieldLabelled] = screen.getAllByRole("switch");
    expect(nativeLabelled).not.toHaveAttribute("aria-labelledby");
    expect(nativeLabelled).toHaveAccessibleName("Wi-Fi");
    expect(fieldLabelled).not.toHaveAttribute("aria-labelledby");
    expect(fieldLabelled).toHaveAccessibleName("Bluetooth");
  });

  it("attaches a callback ref to the root element and inputRef to the hidden input", () => {
    let rootInstance: HTMLElement | null = null;
    let inputInstance: HTMLInputElement | null = null;
    mount(() => (
      <SwitchRoot
        ref={(value: HTMLElement) => {
          rootInstance = value;
        }}
        inputRef={(element: HTMLInputElement) => {
          inputInstance = element;
        }}
      />
    ));
    tick();

    expect(rootInstance).toBe(screen.getByRole("switch"));
    const input = inputInstance as HTMLInputElement | null;
    expect(input).toBeInstanceOf(window.HTMLInputElement);
    expect(input?.getAttribute("type")).toBe("checkbox");
  });
});

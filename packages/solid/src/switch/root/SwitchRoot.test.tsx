import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { describeConformance } from "#test-utils";

import { SwitchThumb } from "../thumb/SwitchThumb";
import { SwitchRoot } from "./SwitchRoot";
import * as SwitchRootDataAttributes from "./SwitchRootDataAttributes";

describe("<Switch.Root />", () => {
  describeConformance((props) => <SwitchRoot {...props} />, {
    defaultElement: "span",
    as: { targetElement: "div" },
  });

  it("renders with role switch and unchecked state", () => {
    render(() => <SwitchRoot />);
    const root = screen.getByRole("switch");
    expect(root).toHaveAttribute("aria-checked", "false");
    expect(root).toHaveAttribute(SwitchRootDataAttributes.unchecked, "");
    expect(root).not.toHaveAttribute(SwitchRootDataAttributes.checked);
  });

  it("toggles on click and calls onCheckedChange", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(() => <SwitchRoot onCheckedChange={handleChange} />);
    const root = screen.getByRole("switch");

    await user.click(root);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0]).toBe(true);
    expect(root).toHaveAttribute("aria-checked", "true");
    expect(root).toHaveAttribute(SwitchRootDataAttributes.checked, "");
  });

  it("respects defaultChecked and controlled checked", async () => {
    const user = userEvent.setup();
    render(() => <SwitchRoot defaultChecked />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");

    const handleChange = vi.fn();
    render(() => <SwitchRoot checked={false} onCheckedChange={handleChange} />);
    const controlled = screen.getAllByRole("switch")[1];
    await user.click(controlled);
    expect(handleChange).toHaveBeenCalledWith(true, expect.anything());
    expect(controlled).toHaveAttribute("aria-checked", "false");
  });

  it("does not toggle when disabled or readOnly", async () => {
    const user = userEvent.setup();
    const handleDisabled = vi.fn();
    const handleReadOnly = vi.fn();
    render(() => (
      <>
        <SwitchRoot disabled onCheckedChange={handleDisabled} data-testid="disabled-switch" />
        <SwitchRoot readOnly onCheckedChange={handleReadOnly} data-testid="readonly-switch" />
      </>
    ));

    await user.click(screen.getByTestId("disabled-switch"));
    await user.click(screen.getByTestId("readonly-switch"));

    expect(handleDisabled).not.toHaveBeenCalled();
    expect(handleReadOnly).not.toHaveBeenCalled();
  });

  it("renders a hidden input for uncheckedValue when off", () => {
    render(() => <SwitchRoot name="notifications" uncheckedValue="off" />);
    const hidden = document.querySelector('input[type="hidden"][name="notifications"]') as HTMLInputElement | null;
    expect(hidden).not.toBe(null);
    expect(hidden?.value).toBe("off");
  });

  it("renders thumb inside root", () => {
    render(() => (
      <SwitchRoot>
        <SwitchThumb data-testid="thumb" />
      </SwitchRoot>
    ));
    expect(screen.getByTestId("thumb")).toBeInTheDocument();
  });

  it("forwards value and form to the hidden input instead of leaking them onto the root", () => {
    render(() => <SwitchRoot data-testid="value-switch" name="notifications" value="yes" form="settings-form" />);
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
    render(() => <SwitchRoot data-testid="form-switch" name="alerts" uncheckedValue="off" form="settings-form" />);
    const hidden = screen.getByTestId("form-switch").parentElement?.querySelector('input[type="hidden"]') as HTMLInputElement | null;
    expect(hidden).not.toBe(null);
    expect(hidden?.value).toBe("off");
    expect(hidden?.getAttribute("form")).toBe("settings-form");
    expect(hidden?.getAttribute("name")).toBe("alerts");
  });
});

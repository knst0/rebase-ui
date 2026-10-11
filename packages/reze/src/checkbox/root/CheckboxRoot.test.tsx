import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { Show, signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Field from "../../field/index.parts";
import { CheckboxIndicator } from "../indicator/CheckboxIndicator";
import { CheckboxRoot } from "./CheckboxRoot";
import * as CheckboxRootDataAttributes from "./CheckboxRootDataAttributes";

afterEach(cleanup);

describe("<Checkbox.Root />", () => {
  it("renders a span element by default", () => {
    mount(() => <CheckboxRoot />);
    tick();

    expect(screen.getByRole("checkbox").tagName).toBe("SPAN");
  });

  it("renders the customized root element", () => {
    mount(() => <CheckboxRoot as="div" />);
    tick();

    expect(screen.getByRole("checkbox").tagName).toBe("DIV");
  });

  it("renders with role checkbox and unchecked state", () => {
    mount(() => <CheckboxRoot />);
    tick();

    const root = screen.getByRole("checkbox");
    expect(root).toHaveAttribute("aria-checked", "false");
    expect(root).toHaveAttribute(CheckboxRootDataAttributes.unchecked, "");
    expect(root).not.toHaveAttribute(CheckboxRootDataAttributes.checked);
  });

  it("toggles on click and calls onCheckedChange", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    mount(() => <CheckboxRoot onCheckedChange={handleChange} />);
    tick();

    await user.click(screen.getByRole("checkbox"));
    tick();

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0]).toBe(true);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox")).toHaveAttribute(CheckboxRootDataAttributes.checked, "");
  });

  it("respects defaultChecked and controlled checked", async () => {
    const user = userEvent.setup();
    mount(() => <CheckboxRoot defaultChecked />);
    tick();
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");

    const handleChange = vi.fn();
    mount(() => <CheckboxRoot checked={false} onCheckedChange={handleChange} />);
    tick();
    const controlled = screen.getAllByRole("checkbox")[1];
    await user.click(controlled);
    tick();
    expect(handleChange).toHaveBeenCalledWith(true, expect.anything());
    expect(screen.getAllByRole("checkbox")[1]).toHaveAttribute("aria-checked", "false");
  });

  it("does not toggle when disabled or readOnly", async () => {
    const user = userEvent.setup();
    const handleDisabled = vi.fn();
    const handleReadOnly = vi.fn();
    mount(() => (
      <>
        <CheckboxRoot disabled onCheckedChange={handleDisabled} data-testid="disabled-checkbox" />
        <CheckboxRoot readOnly onCheckedChange={handleReadOnly} data-testid="readonly-checkbox" />
      </>
    ));
    tick();

    await user.click(screen.getByTestId("disabled-checkbox"));
    tick();
    await user.click(screen.getByTestId("readonly-checkbox"));
    tick();

    expect(handleDisabled).not.toHaveBeenCalled();
    expect(handleReadOnly).not.toHaveBeenCalled();
  });

  it("reflects the indeterminate state on the accessible control and the hidden input", () => {
    mount(() => <CheckboxRoot data-testid="checkbox" indeterminate />);
    tick();

    const root = screen.getByTestId("checkbox");
    expect(root).toHaveAttribute("aria-checked", "mixed");
    expect(root).toHaveAttribute(CheckboxRootDataAttributes.indeterminate, "");
    expect(root).not.toHaveAttribute(CheckboxRootDataAttributes.checked);
    expect(root).not.toHaveAttribute(CheckboxRootDataAttributes.unchecked);

    const input = root.parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(input?.indeterminate).toBe(true);
  });

  it("renders a hidden input for uncheckedValue when off", () => {
    mount(() => <CheckboxRoot name="consent" uncheckedValue="no" />);
    tick();

    const hidden = document.querySelector('input[type="hidden"][name="consent"]') as HTMLInputElement | null;
    expect(hidden).not.toBe(null);
    expect(hidden?.value).toBe("no");
  });

  it("renders indicator inside root", () => {
    mount(() => (
      <CheckboxRoot defaultChecked>
        <CheckboxIndicator data-testid="indicator" />
      </CheckboxRoot>
    ));
    tick();

    expect(screen.getByTestId("indicator")).toBeInTheDocument();
  });

  it("forwards value and form to the hidden input instead of leaking them onto the root", () => {
    mount(() => <CheckboxRoot data-testid="value-checkbox" name="consent" value="yes" form="settings-form" />);
    tick();

    const root = screen.getByTestId("value-checkbox");
    expect(root).not.toHaveAttribute("value");
    expect(root).not.toHaveAttribute("form");

    const input = root.parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(input).not.toBe(null);
    expect(input?.value).toBe("yes");
    expect(input?.getAttribute("form")).toBe("settings-form");
    expect(input?.getAttribute("name")).toBe("consent");
  });

  it("attaches a callback ref to the root element and inputRef to the hidden input", () => {
    let rootInstance: HTMLElement | null = null;
    let inputInstance: HTMLInputElement | null = null;
    mount(() => (
      <CheckboxRoot
        ref={(value: HTMLElement) => {
          rootInstance = value;
        }}
        inputRef={(element: HTMLInputElement) => {
          inputInstance = element;
        }}
      />
    ));
    tick();

    expect(rootInstance).toBe(screen.getByRole("checkbox"));
    const input = inputInstance as HTMLInputElement | null;
    expect(input).toBeInstanceOf(window.HTMLInputElement);
    expect(input?.getAttribute("type")).toBe("checkbox");
  });
});

describe("<Checkbox.Root /> native state", () => {
  it.each(["canceled", "controlled", "accepted"] as const)("keeps form submission consistent after a %s change", async (mode) => {
    const user = userEvent.setup();
    mount(() => (
      <form data-testid="form">
        <CheckboxRoot
          name="consent"
          value="yes"
          required
          checked={mode === "controlled" ? false : undefined}
          onCheckedChange={(_checked, details) => {
            if (mode === "canceled") details.cancel();
          }}
        >
          Consent
        </CheckboxRoot>
      </form>
    ));
    tick();

    await user.click(screen.getByRole("checkbox", { name: "Consent" }));
    tick();

    const form = screen.getByTestId("form") as HTMLFormElement;
    const input = form.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const accepted = mode === "accepted";
    expect(screen.getByRole("checkbox", { name: "Consent" })).toHaveAttribute("aria-checked", String(accepted));
    expect(input.checked).toBe(accepted);
    expect(input.validity.valueMissing).toBe(!accepted);
    expect(new FormData(form).get("consent")).toBe(accepted ? "yes" : null);
  });

  it("exposes changing field invalidity on the accessible control", () => {
    function Test() {
      let invalid = signal(true);
      return (
        <Field.Root invalid={() => invalid}>
          <CheckboxRoot>Consent</CheckboxRoot>
          <button data-testid="toggle" onClick={() => (invalid = false)}>
            Toggle
          </button>
        </Field.Root>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    const control = screen.getByRole("checkbox", { name: "Consent" });
    expect(control).toHaveAttribute("aria-invalid", "true");

    fire(el.querySelector('[data-testid="toggle"]')!, "click");
    tick();

    expect(screen.getByRole("checkbox", { name: "Consent" })).not.toHaveAttribute("aria-invalid", "true");
  });

  it("prefers `aria-label` over an associated label", () => {
    mount(() => (
      <>
        <label>
          <CheckboxRoot aria-label="lease.pdf" />
          lease.pdf
        </label>
        <Field.Root>
          <Field.Label>
            <CheckboxRoot aria-label="notes.txt" />
            notes.txt
          </Field.Label>
        </Field.Root>
      </>
    ));
    tick();

    const [nativeLabelled, fieldLabelled] = screen.getAllByRole("checkbox");
    expect(nativeLabelled).not.toHaveAttribute("aria-labelledby");
    expect(nativeLabelled).toHaveAccessibleName("lease.pdf");
    expect(fieldLabelled).not.toHaveAttribute("aria-labelledby");
    expect(fieldLabelled).toHaveAccessibleName("notes.txt");
  });

  it.each(["", " ", "\n\t "] as const)("ignores a blank `aria-label` (%j)", (ariaLabel) => {
    mount(() => (
      <>
        <label>
          <CheckboxRoot aria-label={ariaLabel} />
          Native label
        </label>
        <Field.Root>
          <Field.Label>
            <CheckboxRoot aria-label={ariaLabel} />
            Field label
          </Field.Label>
        </Field.Root>
      </>
    ));
    tick();

    const [nativeLabelled, fieldLabelled] = screen.getAllByRole("checkbox");
    expect(nativeLabelled).toHaveAccessibleName("Native label");
    expect(fieldLabelled).toHaveAccessibleName("Field label");
  });

  describe("[data-focused] without a blur event", () => {
    it("is removed when the focused checkbox becomes disabled", () => {
      function Test() {
        let disabled = signal(false);
        return (
          <Field.Root data-testid="root">
            <CheckboxRoot data-testid="first" disabled={disabled} />
            <button data-testid="toggle" onClick={() => (disabled = true)}>
              Disable
            </button>
          </Field.Root>
        );
      }
      const { el } = mount(() => <Test />);
      tick();

      (el.querySelector('[data-testid="first"]') as HTMLElement).focus();
      tick();

      expect(el.querySelector('[data-testid="root"]')).toHaveAttribute("data-focused", "");

      fire(el.querySelector('[data-testid="toggle"]')!, "click");
      tick();

      expect(el.querySelector('[data-testid="root"]')).not.toHaveAttribute("data-focused");
      expect(el.querySelector('[data-testid="first"]')).not.toHaveAttribute("data-focused");
    });

    it("is removed when the focused checkbox unmounts", () => {
      function Test() {
        let mounted = signal(true);
        return (
          <Field.Root data-testid="root">
            <Show when={mounted}>
              <CheckboxRoot data-testid="first" />
            </Show>
            <button data-testid="toggle" onClick={() => (mounted = false)}>
              Unmount
            </button>
          </Field.Root>
        );
      }
      const { el } = mount(() => <Test />);
      tick();

      (el.querySelector('[data-testid="first"]') as HTMLElement).focus();
      tick();

      expect(el.querySelector('[data-testid="root"]')).toHaveAttribute("data-focused", "");

      fire(el.querySelector('[data-testid="toggle"]')!, "click");
      tick();

      expect(el.querySelector('[data-testid="root"]')).not.toHaveAttribute("data-focused");
    });
  });

  it("updates the accessible name when `aria-label` is added, cleared, or removed", () => {
    function Test() {
      let ariaLabel = signal<string | undefined>(undefined);
      return (
        <>
          <label>
            <CheckboxRoot aria-label={ariaLabel} />
            Associated label
          </label>
          <button data-testid="custom" onClick={() => (ariaLabel = "Custom name")}>
            Custom
          </button>
          <button data-testid="blank" onClick={() => (ariaLabel = " \n\t ")}>
            Blank
          </button>
          <button data-testid="clear" onClick={() => (ariaLabel = undefined)}>
            Clear
          </button>
        </>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    const checkbox = () => screen.getByRole("checkbox");
    expect(checkbox()).toHaveAccessibleName("Associated label");

    fire(el.querySelector('[data-testid="custom"]')!, "click");
    tick();
    expect(checkbox()).toHaveAccessibleName("Custom name");
    expect(checkbox()).not.toHaveAttribute("aria-labelledby");

    fire(el.querySelector('[data-testid="blank"]')!, "click");
    tick();
    expect(checkbox()).toHaveAccessibleName("Associated label");

    fire(el.querySelector('[data-testid="custom"]')!, "click");
    tick();
    expect(checkbox()).toHaveAccessibleName("Custom name");

    fire(el.querySelector('[data-testid="clear"]')!, "click");
    tick();
    expect(checkbox()).toHaveAccessibleName("Associated label");
  });

  it("updates the accessible name when the associated field label mounts and unmounts", () => {
    function Test() {
      let showLabel = signal(false);
      let ariaLabel = signal<string | undefined>(undefined);
      return (
        <Field.Root>
          <Show when={showLabel}>
            <Field.Label>Associated label</Field.Label>
          </Show>
          <CheckboxRoot id="dynamic-label" aria-label={ariaLabel} />
          <button data-testid="show" onClick={() => (showLabel = true)}>
            Show
          </button>
          <button data-testid="hide" onClick={() => (showLabel = false)}>
            Hide
          </button>
          <button data-testid="custom" onClick={() => (ariaLabel = "Custom name")}>
            Custom
          </button>
          <button data-testid="clear" onClick={() => (ariaLabel = undefined)}>
            Clear
          </button>
        </Field.Root>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    const click = (testId: string) => {
      fire(el.querySelector(`[data-testid="${testId}"]`)!, "click");
      tick();
    };
    const checkbox = () => screen.getByRole("checkbox");

    expect(checkbox()).toHaveAccessibleName("");

    click("show");
    expect(checkbox()).toHaveAccessibleName("Associated label");

    click("hide");
    expect(checkbox()).toHaveAccessibleName("");
    expect(checkbox()).not.toHaveAttribute("aria-labelledby");

    click("custom");
    expect(checkbox()).toHaveAccessibleName("Custom name");

    click("show");
    expect(checkbox()).toHaveAccessibleName("Custom name");

    click("hide");
    expect(checkbox()).toHaveAccessibleName("Custom name");

    click("show");
    click("clear");
    expect(checkbox()).toHaveAccessibleName("Associated label");
  });
});

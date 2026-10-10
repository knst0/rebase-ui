import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { createRenderer } from "#test-utils";

import { Field } from "../../field";
import { CheckboxRoot } from "./CheckboxRoot";

describe("<Checkbox.Root /> native state", () => {
  const { render } = createRenderer();

  it.each(["canceled", "controlled", "accepted"] as const)("keeps form submission consistent after a %s change", async (mode) => {
    await render(() => (
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

    const control = screen.getByRole("checkbox", { name: "Consent" });
    control.click();
    flush();

    const form = screen.getByTestId("form") as HTMLFormElement;
    const input = form.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const accepted = mode === "accepted";
    expect(control).toHaveAttribute("aria-checked", String(accepted));
    expect(input.checked).toBe(accepted);
    expect(input.validity.valueMissing).toBe(!accepted);
    expect(new FormData(form).get("consent")).toBe(accepted ? "yes" : null);
  });

  it("exposes changing field invalidity on the accessible control", async () => {
    const [invalid, setInvalid] = createSignal(true);
    await render(() => (
      <Field.Root invalid={invalid}>
        <CheckboxRoot>Consent</CheckboxRoot>
      </Field.Root>
    ));

    const control = screen.getByRole("checkbox", { name: "Consent" });
    expect(control).toHaveAttribute("aria-invalid", "true");
    setInvalid(false);
    flush();
    expect(control).not.toHaveAttribute("aria-invalid", "true");
  });

  it("prefers `aria-label` over an associated label", async () => {
    await render(() => (
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

    const [nativeLabelled, fieldLabelled] = screen.getAllByRole("checkbox");
    expect(nativeLabelled).not.toHaveAttribute("aria-labelledby");
    expect(nativeLabelled).toHaveAccessibleName("lease.pdf");
    expect(fieldLabelled).not.toHaveAttribute("aria-labelledby");
    expect(fieldLabelled).toHaveAccessibleName("notes.txt");
  });

  it.each(["", " ", "\n\t "] as const)("ignores a blank `aria-label` (%j)", async (ariaLabel) => {
    await render(() => (
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

    const [nativeLabelled, fieldLabelled] = screen.getAllByRole("checkbox");
    expect(nativeLabelled).toHaveAccessibleName("Native label");
    expect(fieldLabelled).toHaveAccessibleName("Field label");
  });

  describe("[data-focused] without a blur event", () => {
    it("is removed when the focused checkbox becomes disabled", async () => {
      const [disabled, setDisabled] = createSignal(false);
      await render(() => (
        <Field.Root data-testid="root">
          <CheckboxRoot data-testid="first" disabled={disabled()} />
        </Field.Root>
      ));

      const button = screen.getByTestId("first") as HTMLElement;
      button.focus();
      flush();

      expect(screen.getByTestId("root")).toHaveAttribute("data-focused", "");

      setDisabled(true);
      flush();

      expect(screen.getByTestId("root")).not.toHaveAttribute("data-focused");
      expect(button).not.toHaveAttribute("data-focused");
    });

    it("is removed when the focused checkbox unmounts", async () => {
      const [mounted, setMounted] = createSignal(true);
      await render(() => <Field.Root data-testid="root">{mounted() ? <CheckboxRoot data-testid="first" /> : null}</Field.Root>);

      (screen.getByTestId("first") as HTMLElement).focus();
      flush();

      expect(screen.getByTestId("root")).toHaveAttribute("data-focused", "");

      setMounted(false);
      flush();

      expect(screen.getByTestId("root")).not.toHaveAttribute("data-focused");
    });
  });

  it("updates the accessible name when `aria-label` is added, cleared, or removed", async () => {
    const [ariaLabel, setAriaLabel] = createSignal<string | undefined>(undefined);
    await render(() => (
      <label>
        <CheckboxRoot aria-label={ariaLabel()} />
        Associated label
      </label>
    ));

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAccessibleName("Associated label");

    setAriaLabel("Custom name");
    flush();
    expect(checkbox).toHaveAccessibleName("Custom name");
    expect(checkbox).not.toHaveAttribute("aria-labelledby");

    setAriaLabel(" \n\t ");
    flush();
    expect(checkbox).toHaveAccessibleName("Associated label");

    setAriaLabel("Custom name");
    flush();
    expect(checkbox).toHaveAccessibleName("Custom name");

    setAriaLabel(undefined);
    flush();
    expect(checkbox).toHaveAccessibleName("Associated label");
  });
});

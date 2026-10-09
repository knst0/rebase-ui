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
});

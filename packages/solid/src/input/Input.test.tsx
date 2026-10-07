import "@testing-library/jest-dom/vitest";
import { fireEvent, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { createRenderer, describeConformance } from "#test-utils";

import { Field } from "../field";
import { Input } from "./Input";
import * as InputDataAttributes from "./InputDataAttributes";

describe("<Input />", () => {
  const { render } = createRenderer();

  describeConformance((props) => <Input {...props} />, {
    defaultElement: "input",
    refInstanceof: window.HTMLInputElement,
  });

  it("renders a native input element", async () => {
    await render(() => <Input data-testid="input" />);

    expect(screen.getByTestId("input").tagName).toBe("INPUT");
  });

  it("supports an uncontrolled defaultValue and reports changes via onValueChange", async () => {
    const onValueChange = vi.fn();

    await render(() => <Input data-testid="input" defaultValue="initial" onValueChange={onValueChange} />);

    const input = screen.getByTestId("input") as HTMLInputElement;
    expect(input.value).toBe("initial");

    fireEvent.change(input, { target: { value: "typed" } });
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.lastCall?.[0]).toBe("typed");
  });

  it("supports a controlled value", async () => {
    const [value, setValue] = createSignal("a");

    await render(() => <Input data-testid="input" value={value()} onValueChange={(next) => setValue(next)} />);

    const input = screen.getByTestId("input") as HTMLInputElement;
    expect(input.value).toBe("a");

    fireEvent.change(input, { target: { value: "ab" } });
    flush();

    expect(input.value).toBe("ab");
  });

  it("forwards the disabled state", async () => {
    await render(() => <Input data-testid="input" disabled />);

    const input = screen.getByTestId("input");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute(InputDataAttributes.disabled);
  });

  it("works inside Field.Root with label, filled, and error states", async () => {
    await render(() => (
      <Field.Root validationMode="onChange">
        <Field.Label>Name</Field.Label>
        <Input data-testid="input" defaultValue="value" required />
        <Field.Error match="valueMissing">Required</Field.Error>
      </Field.Root>
    ));

    const input = screen.getByTestId("input");
    expect(input).toHaveAttribute(InputDataAttributes.filled);
    expect(screen.getByText("Name").getAttribute("for")).toBe(input.getAttribute("id"));

    fireEvent.change(input, { target: { value: "" } });
    flush();
    await Promise.resolve();
    await Promise.resolve();
    flush();

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("marks touched and focused state attributes on focus and blur", async () => {
    await render(() => (
      <Field.Root>
        <Input data-testid="input" />
      </Field.Root>
    ));

    const input = screen.getByTestId("input");

    fireEvent.focus(input);
    flush();
    expect(input).toHaveAttribute(InputDataAttributes.focused);

    fireEvent.blur(input);
    flush();
    expect(input).toHaveAttribute(InputDataAttributes.touched);
    expect(input).not.toHaveAttribute(InputDataAttributes.focused);
  });

  it("reads no reactive values outside a tracking scope while interacting", async () => {
    const diagnostics: string[] = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    const recordDiagnostic = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
        diagnostics.push(args[0]);
      }
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      recordDiagnostic(...args);
      originalWarn(...args);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      recordDiagnostic(...args);
      originalError(...args);
    });

    try {
      await render(() => (
        <Field.Root>
          <Input data-testid="input" defaultValue="" />
        </Field.Root>
      ));

      const input = screen.getByTestId("input") as HTMLInputElement;

      fireEvent.focus(input);
      flush();
      fireEvent.change(input, { target: { value: "hello" } });
      flush();
      fireEvent.blur(input);
      flush();
      fireEvent.change(input, { target: { value: "" } });
      flush();
      fireEvent.focus(input);
      flush();
      fireEvent.blur(input);
      flush();

      expect(input.value).toBe("");
      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

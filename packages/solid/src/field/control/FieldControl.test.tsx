import "@testing-library/jest-dom/vitest";
import { fireEvent, screen } from "@solidjs/testing-library";
import { createSignal, flush, OBSERVE, Show } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { createRenderer, describeConformance } from "#test-utils";

import { Form } from "../../form";
import * as Field from "../index.parts";

describe("<Field.Control />", () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => (
      <Field.Root>
        <Field.Control {...props} />
      </Field.Root>
    ),
    () => ({
      render,
      defaultElement: "input",
      refInstanceof: window.HTMLInputElement,
    }),
  );

  it("renders a native input inside the field", async () => {
    await render(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
      </Field.Root>
    ));

    expect(screen.getByTestId("control").tagName).toBe("INPUT");
  });

  it("validates once when changed by the user", async () => {
    const validate = vi.fn();

    await render(() => (
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control />
      </Field.Root>
    ));

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a" } });
    flush();
    await Promise.resolve();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe("a");
  });

  it("calls onValueChange with the new value", async () => {
    const onValueChange = vi.fn();

    await render(() => (
      <Field.Root validationMode="onChange">
        <Field.Control onValueChange={onValueChange} />
      </Field.Root>
    ));

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.lastCall?.[0]).toBe("abc");
  });

  it("shows a required error when a prefilled value is cleared", async () => {
    const onValueChange = vi.fn();
    await render(() => (
      <Field.Root validationMode="onChange">
        <Field.Control data-testid="control" defaultValue="value" required onValueChange={onValueChange} />
        <Field.Error match="valueMissing">Required</Field.Error>
      </Field.Root>
    ));

    const control = screen.getByTestId("control");

    fireEvent.change(control, { target: { value: "" } });
    flush();

    expect(onValueChange).toHaveBeenCalledWith("", expect.anything());
    await Promise.resolve();
    await Promise.resolve();
    flush();

    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("marks filled when a value is present", async () => {
    await render(() => (
      <Field.Root>
        <Field.Control data-testid="control" defaultValue="value" />
      </Field.Root>
    ));

    expect(screen.getByTestId("control")).toHaveAttribute("data-filled");
  });

  it("commits on Enter keydown", async () => {
    const validate = vi.fn(() => null);

    await render(() => (
      <Form>
        <Field.Root validate={validate}>
          <Field.Control />
        </Field.Root>
      </Form>
    ));

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    flush();
    await Promise.resolve();

    expect(validate).toHaveBeenCalledTimes(1);
  });

  describe("[data-focused]", () => {
    it("is removed when the focused control becomes disabled", async () => {
      const [disabled, setDisabled] = createSignal(false);
      await render(() => (
        <Field.Root data-testid="root">
          <Field.Label data-testid="label">Name</Field.Label>
          <Field.Control data-testid="first" disabled={disabled()} />
        </Field.Root>
      ));

      const control = screen.getByTestId("first") as HTMLElement;
      control.focus();
      flush();

      expect(screen.getByTestId("root")).toHaveAttribute("data-focused", "");
      expect(control).toHaveAttribute("data-focused", "");

      setDisabled(true);
      flush();

      expect(screen.getByTestId("root")).not.toHaveAttribute("data-focused");
      expect(control).not.toHaveAttribute("data-focused");
      expect(screen.getByTestId("label")).not.toHaveAttribute("data-focused");
    });

    it("is removed when the field root becomes disabled", async () => {
      const [disabled, setDisabled] = createSignal(false);
      await render(() => (
        <Field.Root data-testid="root" disabled={disabled}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      (screen.getByTestId("control") as HTMLElement).focus();
      flush();
      expect(screen.getByTestId("root")).toHaveAttribute("data-focused", "");

      setDisabled(true);
      flush();

      expect(screen.getByTestId("root")).not.toHaveAttribute("data-focused");
    });

    it("can be re-acquired after the control is re-enabled", async () => {
      const [disabled, setDisabled] = createSignal(false);
      await render(() => (
        <>
          <Field.Root data-testid="root">
            <Field.Control data-testid="first" disabled={disabled()} />
          </Field.Root>
          <button type="button" data-testid="outside" />
        </>
      ));

      const control = screen.getByTestId("first") as HTMLElement;
      control.focus();
      flush();
      expect(screen.getByTestId("root")).toHaveAttribute("data-focused", "");

      setDisabled(true);
      flush();
      expect(screen.getByTestId("root")).not.toHaveAttribute("data-focused");

      // Browsers move focus off a disabled control; jsdom leaves it as the active element.
      (screen.getByTestId("outside") as HTMLElement).focus();
      flush();

      setDisabled(false);
      flush();
      expect(screen.getByTestId("root")).not.toHaveAttribute("data-focused");

      control.focus();
      flush();
      expect(screen.getByTestId("root")).toHaveAttribute("data-focused", "");
    });

    it("is removed when the focused control unmounts", async () => {
      const [mounted, setMounted] = createSignal(true);
      await render(() => (
        <Field.Root data-testid="root">
          <Field.Label data-testid="label">Name</Field.Label>
          <Show when={mounted()}>
            <Field.Control data-testid="first" />
          </Show>
        </Field.Root>
      ));

      (screen.getByTestId("first") as HTMLElement).focus();
      flush();

      expect(screen.getByTestId("root")).toHaveAttribute("data-focused", "");

      setMounted(false);
      flush();

      expect(screen.getByTestId("root")).not.toHaveAttribute("data-focused");
      expect(screen.getByTestId("label")).not.toHaveAttribute("data-focused");
    });

    it("emits no untracked reads across focus, disable, re-enable, and unmount", async () => {
      const diagnostics: string[] = [];
      const recordDiagnostic = (...args: unknown[]) => {
        if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
          diagnostics.push(args[0]);
        }
      };
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(recordDiagnostic);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(recordDiagnostic);
      const attribution = OBSERVE?.diagnostics.capture();

      try {
        const [disabled, setDisabled] = createSignal(false);
        const [mounted, setMounted] = createSignal(true);
        await render(() => (
          <Field.Root data-testid="root">
            <Show when={mounted()}>
              <Field.Control data-testid="first" disabled={disabled()} />
            </Show>
          </Field.Root>
        ));

        const control = screen.getByTestId("first") as HTMLElement;
        control.focus();
        flush();
        setDisabled(true);
        flush();
        setDisabled(false);
        flush();
        control.focus();
        flush();
        setMounted(false);
        flush();

        const events = (attribution?.events ?? []).map((event) => JSON.stringify(event));
        expect(diagnostics, events.length > 0 ? `attribution: ${events.join("\n")}` : undefined).toEqual([]);
        expect(events).toEqual([]);
      } finally {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        attribution?.stop();
      }
    });
  });

  describe("defaultValue", () => {
    it("forwards a changing defaultValue and resyncs the filled state", async () => {
      const [defaultValue, setDefaultValue] = createSignal("");
      await render(() => (
        <Field.Root data-testid="root">
          <Field.Control defaultValue={defaultValue()} />
        </Field.Root>
      ));

      const root = screen.getByTestId("root");
      expect(root).not.toHaveAttribute("data-filled");

      setDefaultValue("value");
      flush();

      expect(screen.getByRole("textbox")).toHaveValue("value");
      expect(root).toHaveAttribute("data-filled", "");

      setDefaultValue("");
      flush();

      expect(screen.getByRole("textbox")).toHaveValue("");
      expect(root).not.toHaveAttribute("data-filled");
    });

    it("keeps filled state from the edited value when defaultValue changes", async () => {
      const [defaultValue, setDefaultValue] = createSignal("");
      await render(() => (
        <Field.Root data-testid="root">
          <Field.Control defaultValue={defaultValue()} />
        </Field.Root>
      ));

      const root = screen.getByTestId("root");
      const input = screen.getByRole("textbox") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "typed" } });
      flush();
      expect(root).toHaveAttribute("data-filled", "");

      setDefaultValue("next");
      flush();
      setDefaultValue("");
      flush();

      expect(input).toHaveValue("typed");
      expect(root).toHaveAttribute("data-filled", "");
    });
  });
});

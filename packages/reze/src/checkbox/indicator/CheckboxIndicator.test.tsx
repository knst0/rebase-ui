import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { CheckboxRoot } from "../root/CheckboxRoot";
import { CheckboxRootContext } from "../root/CheckboxRootContext";
import { CheckboxIndicator } from "./CheckboxIndicator";

afterEach(cleanup);

const testContext: CheckboxRootContext = {
  checked: () => false,
  disabled: () => false,
  readOnly: () => false,
  required: () => false,
  indeterminate: () => false,
  dirty: () => false,
  touched: () => false,
  filled: () => false,
  focused: () => false,
  valid: () => null,
  validating: () => false,
};

describe("<Checkbox.Indicator />", () => {
  it("renders a span element by default", () => {
    mount(() => (
      <CheckboxRootContext value={{ ...testContext, checked: () => true }}>
        <CheckboxIndicator data-testid="indicator" />
      </CheckboxRootContext>
    ));
    tick();

    expect(screen.getByTestId("indicator").tagName).toBe("SPAN");
  });

  it("renders the customized indicator element", () => {
    mount(() => (
      <CheckboxRootContext value={{ ...testContext, checked: () => true }}>
        <CheckboxIndicator as="div" data-testid="indicator" />
      </CheckboxRootContext>
    ));
    tick();

    expect(screen.getByTestId("indicator").tagName).toBe("DIV");
  });

  it("is absent when the checkbox is unchecked and present when it is checked", async () => {
    const user = userEvent.setup();
    mount(() => (
      <CheckboxRoot>
        <CheckboxIndicator data-testid="indicator" />
      </CheckboxRoot>
    ));
    tick();

    expect(screen.queryByTestId("indicator")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));
    tick();

    expect(screen.getByTestId("indicator")).toBeInTheDocument();
  });

  it("stays mounted when keepMounted is true", () => {
    mount(() => (
      <CheckboxRootContext value={testContext}>
        <CheckboxIndicator keepMounted data-testid="indicator" />
      </CheckboxRootContext>
    ));
    tick();

    expect(screen.getByTestId("indicator")).toBeInTheDocument();
  });

  it("throws a descriptive error when rendered outside <Checkbox.Root>", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() => {
        mount(() => <CheckboxIndicator />);
        tick();
      }).toThrow("Rebase UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>.");
    } finally {
      errorSpy.mockRestore();
    }
  });
});

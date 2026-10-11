import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { SwitchRootContext } from "../root/SwitchRootContext";
import { SwitchThumb } from "./SwitchThumb";

afterEach(cleanup);

const testContext: SwitchRootContext = {
  checked: () => false,
  disabled: () => false,
  readOnly: () => false,
  required: () => false,
  dirty: () => false,
  touched: () => false,
  filled: () => false,
  focused: () => false,
  valid: () => null,
  validating: () => false,
};

describe("<Switch.Thumb />", () => {
  it("renders a span element by default", () => {
    mount(() => (
      <SwitchRootContext value={testContext}>
        <SwitchThumb data-testid="thumb" />
      </SwitchRootContext>
    ));
    tick();

    expect(screen.getByTestId("thumb").tagName).toBe("SPAN");
  });

  it("renders the customized thumb element", () => {
    mount(() => (
      <SwitchRootContext value={testContext}>
        <SwitchThumb as="div" data-testid="thumb" />
      </SwitchRootContext>
    ));
    tick();

    expect(screen.getByTestId("thumb").tagName).toBe("DIV");
  });

  it("throws a descriptive error when rendered outside <Switch.Root>", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() => {
        mount(() => <SwitchThumb />);
        tick();
      }).toThrow("Rebase UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.");
    } finally {
      errorSpy.mockRestore();
    }
  });
});

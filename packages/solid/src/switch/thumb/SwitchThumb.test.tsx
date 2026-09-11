import { render } from "@solidjs/testing-library";
import { expect, it } from "vitest";

import { describeConformance } from "#test-utils";

import { SwitchRootContext } from "../root/SwitchRootContext";
import { SwitchThumb } from "./SwitchThumb";

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
};

describe("<Switch.Thumb />", () => {
  describeConformance(
    (props) => (
      <SwitchRootContext value={testContext}>
        <SwitchThumb {...props} />
      </SwitchRootContext>
    ),
    {
      defaultElement: "span",
      as: { targetElement: "div" },
    },
  );

  it("throws a descriptive error when rendered outside <Switch.Root>", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(render(() => <SwitchThumb />)).rejects.toThrow(
        "Rebase UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.",
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});

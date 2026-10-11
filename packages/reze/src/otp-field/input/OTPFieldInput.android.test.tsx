import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { OTPField } from "../index";
import type { OTPFieldRoot } from "../root/OTPFieldRoot";

vi.mock("../../internals/utils/platform", async () => {
  const actual = await vi.importActual<typeof import("../../internals/utils/platform")>("../../internals/utils/platform");

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, android: true },
    },
  };
});

afterEach(cleanup);

const OTP_LENGTH = 3;

function OTPFixture(props: Partial<OTPFieldRoot.Props> = {}) {
  const rootProps = { length: OTP_LENGTH, ...props } as OTPFieldRoot.Props;
  return (
    <OTPField.Root {...rootProps}>
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <OTPField.Input aria-label={index === 0 ? undefined : `Character ${index + 1} of ${OTP_LENGTH}`} />
      ))}
    </OTPField.Root>
  );
}

function slotInputs() {
  return Array.from(screen.getByRole("group").querySelectorAll("input")) as HTMLInputElement[];
}

async function settle() {
  tick();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  tick();
}

describe("<OTPField.Input /> Android", () => {
  it("commits each change during an IME composition", async () => {
    const onValueChange = vi.fn();

    mount(() => <OTPFixture validationType="alphanumeric" onValueChange={onValueChange} />);
    await settle();

    const inputs = slotInputs();
    inputs[0].focus();

    fire(inputs[0], "compositionstart");
    inputs[0].value = "a";
    fire(inputs[0], "input");
    await settle();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("a", expect.anything());
    expect(document.activeElement).toBe(inputs[1]);

    fire(inputs[0], "compositionend");
    await settle();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(slotInputs().map((input) => input.value)).toEqual(["a", "", ""]);
  });
});

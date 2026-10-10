import { fireEvent, screen } from "@solidjs/testing-library";
import "@testing-library/jest-dom/vitest";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { createRenderer } from "#test-utils";

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

const OTP_LENGTH = 3;

function OTPFixture(props: Partial<OTPFieldRoot.Props> = {}) {
  return (
    <OTPField.Root length={OTP_LENGTH} {...props}>
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
  flush();
  await Promise.resolve();
  flush();
}

describe("<OTPField.Input /> Android", () => {
  const { render: renderWithFlush } = createRenderer();

  it("commits each change during an IME composition", async () => {
    const onValueChange = vi.fn();

    await renderWithFlush(() => <OTPFixture validationType="alphanumeric" onValueChange={onValueChange} />);

    const inputs = slotInputs();
    inputs[0].focus();

    fireEvent.compositionStart(inputs[0]);
    fireEvent.input(inputs[0], { target: { value: "a" } });
    await settle();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("a", expect.anything());
    expect(document.activeElement).toBe(inputs[1]);

    fireEvent.compositionEnd(inputs[0]);
    await settle();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(slotInputs().map((input) => input.value)).toEqual(["a", "", ""]);
  });
});

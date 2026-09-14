import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { createRenderer, describeConformance, pressKey } from "#test-utils";

import { Radio } from "../radio";
import { RadioRoot } from "../radio/root/RadioRoot";
import { RadioGroup } from "./RadioGroup";

describe("<RadioGroup />", () => {
  const { render } = createRenderer();

  describeConformance((props) => <RadioGroup {...props} />, {
    defaultElement: "div",
  });

  it("renders with role radiogroup and no selection", async () => {
    await render(() => (
      <RadioGroup>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));

    const group = screen.getByRole("radiogroup");
    expect(group).toBeInTheDocument();

    const [radio1, radio2] = screen.getAllByRole("radio");
    expect(radio1).toHaveAttribute("aria-checked", "false");
    expect(radio2).toHaveAttribute("aria-checked", "false");
  });

  it("selects the defaultValue radio", async () => {
    await render(() => (
      <RadioGroup defaultValue="two">
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));

    const [radio1, radio2] = screen.getAllByRole("radio");
    expect(radio1).toHaveAttribute("aria-checked", "false");
    expect(radio2).toHaveAttribute("aria-checked", "true");
    expect(radio2).toHaveAttribute("data-checked");
    expect(radio1).toHaveAttribute("data-unchecked");
  });

  it("changes selection on click and fires onValueChange", async () => {
    const onValueChange = vi.fn();
    const { user } = await render(() => (
      <RadioGroup defaultValue="one" onValueChange={onValueChange}>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));

    const [radio1, radio2] = screen.getAllByRole("radio");

    await user.click(radio2);
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("two");
    expect(radio1).toHaveAttribute("aria-checked", "false");
    expect(radio2).toHaveAttribute("aria-checked", "true");
  });

  it("does not change the value when the event is canceled", async () => {
    const onValueChange = vi.fn((_value: string, eventDetails: RadioGroup.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    const { user } = await render(() => (
      <RadioGroup defaultValue="one" onValueChange={onValueChange}>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));

    const [radio1, radio2] = screen.getAllByRole("radio");

    await user.click(radio2);
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(radio1).toHaveAttribute("aria-checked", "true");
    expect(radio2).toHaveAttribute("aria-checked", "false");
  });

  it("supports a controlled value", async () => {
    const [value, setValue] = createSignal<string | undefined>("one");

    await render(() => (
      <RadioGroup value={value()}>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));

    const [radio1, radio2] = screen.getAllByRole("radio");
    expect(radio1).toHaveAttribute("aria-checked", "true");

    setValue("two");
    flush();

    expect(radio1).toHaveAttribute("aria-checked", "false");
    expect(radio2).toHaveAttribute("aria-checked", "true");
  });

  it("does not change a controlled value on its own", async () => {
    const onValueChange = vi.fn();
    const { user } = await render(() => (
      <RadioGroup value="one" onValueChange={onValueChange}>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));

    const [radio1, radio2] = screen.getAllByRole("radio");

    await user.click(radio2);
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(radio1).toHaveAttribute("aria-checked", "true");
    expect(radio2).toHaveAttribute("aria-checked", "false");
  });

  it("disables the whole group", async () => {
    const onValueChange = vi.fn();
    const { user } = await render(() => (
      <RadioGroup disabled onValueChange={onValueChange}>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));

    const [radio1, radio2] = screen.getAllByRole("radio");
    expect(radio1).toHaveAttribute("data-disabled");
    expect(radio2).toHaveAttribute("data-disabled");

    await user.click(radio1);
    flush();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(radio1).toHaveAttribute("aria-checked", "false");
  });

  it("does not change the value when readOnly", async () => {
    const onValueChange = vi.fn();
    const { user } = await render(() => (
      <RadioGroup defaultValue="one" readOnly onValueChange={onValueChange}>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));

    const [, radio2] = screen.getAllByRole("radio");

    await user.click(radio2);
    flush();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(radio2).toHaveAttribute("aria-checked", "false");
  });

  it("renders hidden inputs carrying the group name and serialized value", async () => {
    await render(() => (
      <RadioGroup name="fruits" defaultValue="apple">
        <Radio.Root value="apple" />
        <Radio.Root value={{ id: "orange" }} />
      </RadioGroup>
    ));

    const inputs = document.querySelectorAll('input[type="radio"][name="fruits"]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveAttribute("value", "apple");
    expect(inputs[1]).toHaveAttribute("value", '{"id":"orange"}');
    expect(inputs[0]).toBeChecked();
  });

  it("moves focus with arrow keys and selects the focused radio", async () => {
    const { user } = await render(() => (
      <RadioGroup defaultValue="one">
        <Radio.Root value="one" />
        <Radio.Root value="two" />
        <Radio.Root value="three" />
      </RadioGroup>
    ));

    const [radio1, radio2, radio3] = screen.getAllByRole("radio");

    await user.keyboard("[Tab]");
    expect(radio1).toHaveFocus();

    pressKey("ArrowRight");
    flush();
    expect(radio2).toHaveFocus();
    expect(radio2).toHaveAttribute("aria-checked", "true");

    pressKey("ArrowRight");
    flush();
    expect(radio3).toHaveFocus();
    expect(radio3).toHaveAttribute("aria-checked", "true");

    pressKey("ArrowLeft");
    flush();
    expect(radio2).toHaveFocus();
    expect(radio2).toHaveAttribute("aria-checked", "true");
  });

  it("reads no reactive values outside a tracking scope while selecting", async () => {
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
      const { user } = await render(() => (
        <RadioGroup defaultValue="one">
          <RadioRoot value="one" />
          <RadioRoot value="two" />
          <RadioRoot value="three" />
        </RadioGroup>
      ));

      const [radio1, radio2, radio3] = screen.getAllByRole("radio");

      await user.keyboard("[Tab]");
      expect(radio1).toHaveFocus();

      pressKey("ArrowRight");
      flush();
      expect(radio2).toHaveFocus();
      expect(radio2).toHaveAttribute("aria-checked", "true");

      pressKey("ArrowRight");
      flush();
      expect(radio3).toHaveFocus();

      await user.click(radio1);
      flush();
      expect(radio1).toHaveAttribute("aria-checked", "true");

      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("selects the focused radio with Space but not with Enter", async () => {
    const { user } = await render(() => (
      <RadioGroup>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));

    const [, radio2] = screen.getAllByRole("radio");

    radio2.focus();
    flush();

    await user.keyboard("[Space]");
    flush();
    expect(radio2).toHaveAttribute("aria-checked", "true");

    await user.keyboard("[Enter]");
    flush();
    expect(radio2).toHaveAttribute("aria-checked", "true");
  });
});

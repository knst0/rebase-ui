import { screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createRenderer, describeConformance } from "#test-utils";

import { ProgressIndicator } from "../indicator/ProgressIndicator";
import { ProgressLabel } from "../label/ProgressLabel";
import { ProgressTrack } from "../track/ProgressTrack";
import { ProgressValue } from "../value/ProgressValue";
import { ProgressRoot } from "./ProgressRoot";

function formatPercent(value: number) {
  return value.toLocaleString(undefined, { style: "percent" });
}

describe("<Progress.Root />", () => {
  const { render } = createRenderer();

  describeConformance((props) => <ProgressRoot value={50} {...props} />, {
    defaultElement: "div",
    as: { targetElement: "span" },
  });

  it("sets aria attributes and associates the label", async () => {
    await render(() => (
      <ProgressRoot value={30}>
        <ProgressLabel>Export</ProgressLabel>
      </ProgressRoot>
    ));

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "30");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuetext", formatPercent(0.3));
    expect(bar.getAttribute("aria-labelledby")).toBe(screen.getByText("Export").getAttribute("id"));
  });

  it.each([
    { value: null, attr: "data-indeterminate" },
    { value: Number.NaN, attr: "data-indeterminate" },
    { value: Number.POSITIVE_INFINITY, attr: "data-indeterminate" },
    { value: 30, attr: "data-progressing" },
    { value: 100, attr: "data-complete" },
    { value: 150, attr: "data-complete" },
  ])("applies only $attr to every part for value $value", async ({ value, attr }) => {
    await render(() => (
      <ProgressRoot value={value} data-testid="root">
        <ProgressLabel data-testid="label" />
        <ProgressValue data-testid="value" />
        <ProgressTrack data-testid="track">
          <ProgressIndicator data-testid="indicator" />
        </ProgressTrack>
      </ProgressRoot>
    ));

    for (const id of ["root", "label", "value", "track", "indicator"]) {
      const element = screen.getByTestId(id);
      for (const name of ["data-indeterminate", "data-progressing", "data-complete"]) {
        expect(element.hasAttribute(name)).toBe(name === attr);
      }
    }
  });

  it("is indeterminate without aria-valuenow, width, or visible value", async () => {
    await render(() => (
      <ProgressRoot value={null}>
        <ProgressValue data-testid="value" />
        <ProgressTrack>
          <ProgressIndicator data-testid="indicator" />
        </ProgressTrack>
      </ProgressRoot>
    ));

    const bar = screen.getByRole("progressbar");
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("aria-valuetext", "indeterminate progress");
    expect(screen.getByTestId("value").textContent).toBe("");
    expect(screen.getByTestId("indicator").style.getPropertyValue("width")).toBe("");
  });

  it("updates every part when value changes, including to and from indeterminate", async () => {
    const [value, setValue] = createSignal<number | null>(null);
    await render(() => (
      <ProgressRoot value={value()}>
        <ProgressValue data-testid="value" />
        <ProgressTrack>
          <ProgressIndicator data-testid="indicator" />
        </ProgressTrack>
      </ProgressRoot>
    ));

    const bar = screen.getByRole("progressbar");
    const indicator = screen.getByTestId("indicator");

    setValue(77);
    flush();
    expect(bar).toHaveAttribute("aria-valuenow", "77");
    expect(bar).toHaveAttribute("data-progressing");
    expect(bar).not.toHaveAttribute("data-indeterminate");
    expect(screen.getByTestId("value").textContent).toBe(formatPercent(0.77));
    expect(indicator.style.getPropertyValue("width")).toBe("77%");
    expect(indicator.style.getPropertyValue("inset-inline-start")).toBe("0px");
    expect(indicator.style.getPropertyValue("height")).toBe("inherit");

    setValue(null);
    flush();
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("data-indeterminate");
    expect(indicator.style.getPropertyValue("width")).toBe("");
  });

  it("clamps and normalizes against a custom range", async () => {
    await render(() => (
      <ProgressRoot value={40} min={20} max={30}>
        <ProgressValue data-testid="value" />
        <ProgressTrack>
          <ProgressIndicator data-testid="indicator" />
        </ProgressTrack>
      </ProgressRoot>
    ));

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "30");
    expect(bar).toHaveAttribute("data-complete");
    expect(screen.getByTestId("indicator").style.getPropertyValue("width")).toBe("100%");
  });

  it("passes formatted and raw values to getAriaValueText", async () => {
    const getAriaValueText = vi.fn((formatted: string, value: number | null) => `${value} / ${formatted}`);
    await render(() => <ProgressRoot value={150} format={{ style: "decimal" }} getAriaValueText={getAriaValueText} />);

    const expected = new Intl.NumberFormat(undefined, { style: "decimal" }).format(100);
    expect(getAriaValueText).toHaveBeenCalledWith(expected, 150);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", `150 / ${expected}`);
  });

  it("calls Value function children with the formatted and raw value", async () => {
    const [value, setValue] = createSignal<number | null>(null);
    await render(() => (
      <ProgressRoot value={value()}>
        <ProgressValue data-testid="value">{(formatted, raw) => `${formatted}:${raw}`}</ProgressValue>
      </ProgressRoot>
    ));

    expect(screen.getByTestId("value").textContent).toBe("indeterminate:null");
    setValue(30);
    flush();
    expect(screen.getByTestId("value").textContent).toBe(`${formatPercent(0.3)}:30`);
  });

  describe("reactivity diagnostics", () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it("emits no STRICT_READ_UNTRACKED warnings", async () => {
      const [value, setValue] = createSignal<number | null>(10);
      await render(() => (
        <ProgressRoot value={value()}>
          <ProgressLabel>Label</ProgressLabel>
          <ProgressValue />
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </ProgressRoot>
      ));
      setValue(null);
      flush();

      expect(warn.mock.calls.filter((call: unknown[]) => String(call[0]).includes("STRICT_READ_UNTRACKED"))).toEqual([]);
    });
  });
});

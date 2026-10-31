import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ProgressIndicator } from "../indicator/ProgressIndicator";
import { ProgressLabel } from "../label/ProgressLabel";
import { ProgressTrack } from "../track/ProgressTrack";
import { ProgressValue } from "../value/ProgressValue";
import { ProgressRoot } from "./ProgressRoot";

afterEach(cleanup);

function formatPercent(value: number) {
  return value.toLocaleString(undefined, { style: "percent" });
}

describe("<Progress.Root />", () => {
  it("renders a div by default and honors `as`", () => {
    mount(() => <ProgressRoot value={50} />);
    expect(screen.getByRole("progressbar").tagName).toBe("DIV");
    cleanup();
    mount(() => <ProgressRoot value={50} as="span" />);
    expect(screen.getByRole("progressbar").tagName).toBe("SPAN");
  });

  it("sets aria attributes and associates the label", () => {
    mount(() => (
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
    { value: 30, attr: "data-progressing" },
    { value: 100, attr: "data-complete" },
    { value: 150, attr: "data-complete" },
  ])("applies only $attr to every part for value $value", ({ value, attr }) => {
    mount(() => (
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

  it("is indeterminate without aria-valuenow, width, or visible value", () => {
    mount(() => (
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

  it("updates every part when value changes", () => {
    function Test() {
      let value: number | null = signal(null);
      return (
        <>
          <ProgressRoot value={value}>
            <ProgressValue data-testid="value" />
            <ProgressTrack>
              <ProgressIndicator data-testid="indicator" />
            </ProgressTrack>
          </ProgressRoot>
          <button onClick={() => (value = 77)}>Set</button>
        </>
      );
    }
    const { el } = mount(() => <Test />);
    fire(el.querySelector("button")!, "click");
    tick();

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "77");
    expect(bar).toHaveAttribute("data-progressing");
    expect(bar).not.toHaveAttribute("data-indeterminate");
    expect(screen.getByTestId("value").textContent).toBe(formatPercent(0.77));
    expect(screen.getByTestId("indicator").style.getPropertyValue("width")).toBe("77%");
  });

  it("passes formatted and raw values to getAriaValueText", () => {
    const getAriaValueText = vi.fn((formatted: string, value: number | null) => `${value} / ${formatted}`);
    mount(() => <ProgressRoot value={150} format={{ style: "decimal" }} getAriaValueText={getAriaValueText} />);

    const expected = new Intl.NumberFormat(undefined, { style: "decimal" }).format(100);
    expect(getAriaValueText).toHaveBeenCalledWith(expected, 150);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", `150 / ${expected}`);
  });

  it("calls Value function children with the formatted and raw value", () => {
    mount(() => (
      <ProgressRoot value={null}>
        <ProgressValue data-testid="value">{(formatted, raw) => `${formatted}:${raw}`}</ProgressValue>
      </ProgressRoot>
    ));

    expect(screen.getByTestId("value").textContent).toBe("indeterminate:null");
  });
});

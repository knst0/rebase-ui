import { render, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { createRenderer, describeConformance } from "#test-utils";

import { MeterIndicator } from "../indicator/MeterIndicator";
import { MeterLabel } from "../label/MeterLabel";
import { MeterTrack } from "../track/MeterTrack";
import { MeterValue } from "../value/MeterValue";
import { MeterRoot } from "./MeterRoot";

function formatPercent(value: number) {
  return value.toLocaleString(undefined, { style: "percent" });
}

describe("<Meter.Root />", () => {
  const { render: renderWithFlush } = createRenderer();

  describeConformance((props) => <MeterRoot value={50} {...props} />, {
    defaultElement: "div",
    as: { targetElement: "span" },
  });

  describe("ARIA attributes", () => {
    it("sets the correct aria attributes and associates the label", async () => {
      await renderWithFlush(() => (
        <MeterRoot value={30}>
          <MeterLabel>Battery Level</MeterLabel>
          <MeterTrack>
            <MeterIndicator />
          </MeterTrack>
        </MeterRoot>
      ));

      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "30");
      expect(meter).toHaveAttribute("aria-valuemin", "0");
      expect(meter).toHaveAttribute("aria-valuemax", "100");
      expect(meter).toHaveAttribute("aria-valuetext", formatPercent(0.3));
      expect(meter.getAttribute("aria-labelledby")).toBe(screen.getByText("Battery Level").getAttribute("id"));
    });

    it("defaults aria-valuetext to the localized formatted value, matching Meter.Value", async () => {
      const expected = new Intl.NumberFormat("de-DE", { style: "percent" }).format(0.3);

      await renderWithFlush(() => (
        <MeterRoot value={30} locale="de-DE">
          <MeterValue data-testid="value" />
        </MeterRoot>
      ));

      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuetext", expected);
      expect(meter.getAttribute("aria-valuetext")).toBe(screen.getByTestId("value").textContent);
    });

    it("refreshes aria-valuenow, aria-valuetext, the value text, and the indicator when value changes", async () => {
      const [value, setValue] = createSignal(50);
      await renderWithFlush(() => (
        <MeterRoot value={value()}>
          <MeterValue data-testid="value" />
          <MeterTrack>
            <MeterIndicator data-testid="indicator" />
          </MeterTrack>
        </MeterRoot>
      ));

      const meter = screen.getByRole("meter");
      const valueElement = screen.getByTestId("value");
      const indicator = screen.getByTestId("indicator");

      expect(meter).toHaveAttribute("aria-valuenow", "50");
      expect(meter).toHaveAttribute("aria-valuetext", formatPercent(0.5));
      expect(valueElement.textContent).toBe(formatPercent(0.5));
      expect(indicator.style.getPropertyValue("width")).toBe("50%");

      setValue(77);
      flush();

      expect(meter).toHaveAttribute("aria-valuenow", "77");
      expect(meter).toHaveAttribute("aria-valuetext", formatPercent(0.77));
      expect(valueElement.textContent).toBe(formatPercent(0.77));
      expect(indicator.style.getPropertyValue("width")).toBe("77%");
    });

    it("positions the indicator with kebab-case styles", async () => {
      await renderWithFlush(() => (
        <MeterRoot value={25}>
          <MeterTrack>
            <MeterIndicator data-testid="indicator" />
          </MeterTrack>
        </MeterRoot>
      ));

      const indicator = screen.getByTestId("indicator");
      expect(indicator.style.getPropertyValue("width")).toBe("25%");
      expect(indicator.style.getPropertyValue("inset-inline-start")).toBe("0px");
      expect(indicator.style.getPropertyValue("height")).toBe("inherit");
    });
  });

  describe("prop: getAriaValueText", () => {
    it("uses the returned text and receives the formatted and raw value", async () => {
      const formatted = formatPercent(0.3);
      const getAriaValueText = vi.fn((formattedValue: string, value: number) => `${value} of 100 (${formattedValue})`);

      await renderWithFlush(() => (
        <MeterRoot value={30} getAriaValueText={getAriaValueText}>
          <MeterValue data-testid="value" />
        </MeterRoot>
      ));

      const meter = screen.getByRole("meter");
      expect(getAriaValueText).toHaveBeenCalledWith(formatted, 30);
      expect(meter).toHaveAttribute("aria-valuetext", `30 of 100 (${formatted})`);
      // getAriaValueText only affects the spoken text, not the visible value.
      expect(screen.getByTestId("value").textContent).toBe(formatted);
    });
  });

  describe("range", () => {
    it("formats the value as its position within a custom range and keeps the indicator in sync", async () => {
      await renderWithFlush(() => (
        <MeterRoot value={0.5} min={0} max={1}>
          <MeterValue data-testid="value" />
          <MeterTrack>
            <MeterIndicator data-testid="indicator" />
          </MeterTrack>
        </MeterRoot>
      ));

      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "0.5");
      expect(meter).toHaveAttribute("aria-valuetext", formatPercent(0.5));
      expect(screen.getByTestId("value").textContent).toBe(formatPercent(0.5));
      expect(screen.getByTestId("indicator").style.getPropertyValue("width")).toBe("50%");
    });

    it("keeps range attributes, formatted text, and the indicator synchronized on update", async () => {
      const [range, setRange] = createSignal({ min: 10, max: 30, value: 20 });
      await renderWithFlush(() => (
        <MeterRoot value={range().value} min={range().min} max={range().max}>
          <MeterValue data-testid="value" />
          <MeterTrack>
            <MeterIndicator data-testid="indicator" />
          </MeterTrack>
        </MeterRoot>
      ));

      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "20");
      expect(meter).toHaveAttribute("aria-valuetext", formatPercent(0.5));
      expect(screen.getByTestId("indicator").style.getPropertyValue("width")).toBe("50%");

      setRange({ min: 20, max: 60, value: 50 });
      flush();

      expect(meter).toHaveAttribute("aria-valuemin", "20");
      expect(meter).toHaveAttribute("aria-valuemax", "60");
      expect(meter).toHaveAttribute("aria-valuenow", "50");
      expect(meter).toHaveAttribute("aria-valuetext", formatPercent(0.75));
      expect(screen.getByTestId("value").textContent).toBe(formatPercent(0.75));
      expect(screen.getByTestId("indicator").style.getPropertyValue("width")).toBe("75%");
    });

    it.each([
      {
        label: "value exceeds max",
        props: { value: 150 },
        ariaValueNow: "100",
        ariaValueText: formatPercent(1),
      },
      {
        label: "value is below min",
        props: { value: -10 },
        ariaValueNow: "0",
        ariaValueText: formatPercent(0),
      },
      {
        label: "min equals max",
        props: { value: 5, min: 5, max: 5 },
        ariaValueNow: "5",
        ariaValueText: formatPercent(0),
      },
      {
        label: "value is NaN",
        props: { value: Number.NaN },
        ariaValueNow: "0",
        ariaValueText: formatPercent(0),
      },
    ])("normalizes aria attributes when $label", async ({ props, ariaValueNow, ariaValueText }) => {
      render(() => <MeterRoot {...props} />);

      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", ariaValueNow);
      expect(meter).toHaveAttribute("aria-valuetext", ariaValueText);
    });
  });

  describe("prop: format", () => {
    it("formats the value", async () => {
      const format: Intl.NumberFormatOptions = { style: "currency", currency: "USD" };
      const expectedValue = new Intl.NumberFormat(undefined, format).format(30);

      await renderWithFlush(() => (
        <MeterRoot value={30} format={format}>
          <MeterValue data-testid="value" />
          <MeterTrack>
            <MeterIndicator />
          </MeterTrack>
        </MeterRoot>
      ));

      expect(screen.getByTestId("value").textContent).toBe(expectedValue);
      expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", expectedValue);
    });

    it("formats the clamped value while clamping range attributes and indicator width", async () => {
      const format: Intl.NumberFormatOptions = { style: "currency", currency: "USD" };
      const expectedValue = new Intl.NumberFormat(undefined, format).format(100);
      const getAriaValueText = vi.fn((formattedValue: string, rawValue: number) => `${formattedValue} (raw: ${rawValue})`);

      await renderWithFlush(() => (
        <MeterRoot value={150} format={format} getAriaValueText={getAriaValueText}>
          <MeterValue data-testid="value" />
          <MeterTrack>
            <MeterIndicator data-testid="indicator" />
          </MeterTrack>
        </MeterRoot>
      ));

      const meter = screen.getByRole("meter");
      expect(screen.getByTestId("value").textContent).toBe(expectedValue);
      expect(meter).toHaveAttribute("aria-valuenow", "100");
      expect(getAriaValueText).toHaveBeenLastCalledWith(expectedValue, 150);
      expect(meter).toHaveAttribute("aria-valuetext", `${expectedValue} (raw: 150)`);
      expect(screen.getByTestId("indicator").style.getPropertyValue("width")).toBe("100%");
    });
  });

  describe("prop: locale", () => {
    it("sets the locale when formatting the value", async () => {
      const expectedValue = new Intl.NumberFormat("de-DE").format(86.49);

      await renderWithFlush(() => (
        <MeterRoot value={86.49} format={{ style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 }} locale="de-DE">
          <MeterValue data-testid="value" />
        </MeterRoot>
      ));

      expect(screen.getByTestId("value").textContent).toBe(expectedValue);
    });
  });

  describe("<Meter.Value />", () => {
    it("supports a render function receiving the formatted and raw value", async () => {
      await renderWithFlush(() => (
        <MeterRoot value={30}>
          <MeterValue data-testid="value">{(formattedValue, value) => `${formattedValue} (${value})`}</MeterValue>
        </MeterRoot>
      ));

      expect(screen.getByTestId("value")).toHaveTextContent(`${formatPercent(0.3)} (30)`);
    });
  });
});

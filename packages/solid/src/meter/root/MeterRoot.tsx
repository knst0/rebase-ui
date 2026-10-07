import type { JSX, ValidComponent } from "@solidjs/web";
import { createMemo, createSignal, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { valueToPercent } from "../../internals/utils/valueToPercent";
import { visuallyHidden } from "../../internals/utils/visuallyHidden";
import { clamp } from "../../slider/utils/clamp";
import { formatNumber } from "../../slider/utils/formatNumber";
import { MeterRootContext } from "./MeterRootContext";

/**
 * Groups all parts of the meter and provides the value for screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Meter](https://rebase-ui.knst.dev/components/meter)
 */
export function MeterRoot<T extends ValidComponent = "div">(props: MeterRoot.Props<T>) {
  const [local, elementProps] = split(props as MeterRoot.Props, { default: defaultProps }, [
    "as",
    "children",
    "format",
    "getAriaValueText",
    "locale",
    "max",
    "min",
    "value",
  ]);

  const as = untrack(() => local.as);

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined);

  // `clamp` handles infinity, but NaN needs an explicit fallback before normalizing range outputs.
  const percentageValue = createMemo(() => {
    const rawPercentage = valueToPercent(local.value, local.min, local.max);
    return clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
  });

  const clampedValue = createMemo(() => {
    const value = local.value;
    return clamp(Number.isNaN(value) ? local.min : value, local.min, local.max);
  });

  // Format the clamped value so visible and accessible text stay in sync with `aria-valuenow` and
  // the indicator fill. The raw value remains available as the second `getAriaValueText` argument.
  const formattedValue = createMemo(() =>
    local.format
      ? formatNumber(clampedValue(), local.locale, local.format)
      : formatNumber(percentageValue() / 100, local.locale, { style: "percent" }),
  );

  const ariaValueText = createMemo(() => {
    const getAriaValueText = local.getAriaValueText;
    if (getAriaValueText) {
      return getAriaValueText(formattedValue(), local.value);
    }
    return formattedValue();
  });

  const state: MeterRootState = {};

  const contextValue: MeterRootContext = {
    formattedValue,
    percentageValue,
    setLabelId,
    state,
    value: () => local.value,
  };

  return (
    <MeterRootContext value={contextValue}>
      <RenderElement
        as={as}
        state={state}
        props={[
          {
            get "aria-labelledby"() {
              return labelId();
            },
            get "aria-valuemax"() {
              return local.max;
            },
            get "aria-valuemin"() {
              return local.min;
            },
            get "aria-valuenow"() {
              return clampedValue();
            },
            get "aria-valuetext"() {
              return ariaValueText();
            },
            role: "meter",
            get children() {
              return (
                <>
                  {local.children as JSX.Element}
                  <span role="presentation" style={visuallyHidden}>
                    {/* force NVDA to read the label https://github.com/mui/base-ui/issues/4184 */}x
                  </span>
                </>
              );
            },
          },
          elementProps,
        ]}
      />
    </MeterRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  max: 100,
  min: 0,
} satisfies Partial<MeterRoot.Props>);

export interface MeterRootState {}

export interface MeterRootOwnProps {
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * A function that returns a string value that provides a human-readable text alternative for `aria-valuenow`, the current value of the meter.
   */
  getAriaValueText?: ((formattedValue: string, value: number) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value.
   */
  value: number;
}

export type MeterRootProps<T extends ValidComponent = "div"> = MeterRootOwnProps & RebaseUIComponentProps<T, MeterRootState>;

export namespace MeterRoot {
  export type State = MeterRootState;
  export type Props<T extends ValidComponent = "div"> = MeterRootProps<T>;
}

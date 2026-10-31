import { clamp } from "@rebase-ui/core/clamp";
import { formatNumber } from "@rebase-ui/core/formatNumber";
import { valueToPercent } from "@rebase-ui/core/valueToPercent";
import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, createSignal, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { visuallyHidden } from "../../internals/utils/visuallyHidden";
import { ProgressRootContext } from "./ProgressRootContext";
import { progressStateAttributesMapping } from "./stateAttributesMapping";

/**
 * Groups all parts of the progress bar and provides the task completion status to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Progress](https://rebase-ui.knst.dev/components/progress)
 */
export function ProgressRoot<T extends ValidComponent = "div">(props: ProgressRoot.Props<T>) {
  const [local, elementProps] = split(props as ProgressRoot.Props, { default: defaultProps }, [
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

  // `value === null` (or any non-finite value) keeps Progress indeterminate. Otherwise compute a
  // single clamped value and normalized percentage so completion status, `aria-valuenow`, the
  // formatted text, the default `aria-valuetext`, and the indicator width all stay in sync for any
  // `min`/`max` (not just the default 0–100).
  const computed = createMemo(() => {
    const value = local.value;
    if (value == null || !Number.isFinite(value)) {
      return {
        status: "indeterminate" as ProgressStatus,
        percentageValue: null,
        clampedValue: null,
        formattedValue: "",
        defaultAriaValueText: "indeterminate progress",
      };
    }

    const rawPercentage = valueToPercent(value, local.min, local.max);
    const percentageValue = clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
    const clampedValue = clamp(value, local.min, local.max);
    // Format the clamped value so visible and accessible text stay in sync with `aria-valuenow` and
    // the indicator fill. The raw value remains available as the second `getAriaValueText` argument.
    const formattedValue = local.format
      ? formatNumber(clampedValue, local.locale, local.format)
      : formatNumber(percentageValue / 100, local.locale, { style: "percent" });

    return {
      status: (clampedValue === local.max ? "complete" : "progressing") as ProgressStatus,
      percentageValue,
      clampedValue,
      formattedValue,
      defaultAriaValueText: formattedValue,
    };
  });

  const status = createMemo(() => computed().status);
  const percentageValue = createMemo(() => computed().percentageValue);
  const formattedValue = createMemo(() => computed().formattedValue);

  const state: ProgressRootState = { status };

  const contextValue: ProgressRootContext = {
    formattedValue,
    percentageValue,
    setLabelId,
    state,
    value: () => local.value,
  };

  return (
    <ProgressRootContext value={contextValue}>
      <RenderElement
        as={as}
        state={state}
        stateAttributesMapping={progressStateAttributesMapping}
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
              return computed().clampedValue ?? undefined;
            },
            get "aria-valuetext"() {
              const getAriaValueText = local.getAriaValueText;
              return getAriaValueText ? getAriaValueText(formattedValue(), local.value) : computed().defaultAriaValueText;
            },
            role: "progressbar",
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
    </ProgressRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  max: 100,
  min: 0,
} satisfies Partial<ProgressRoot.Props>);

export type ProgressStatus = "indeterminate" | "progressing" | "complete";

export interface ProgressRootState {
  /**
   * The current status.
   */
  status: Accessor<ProgressStatus>;
}

export interface ProgressRootOwnProps {
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * Accepts a function which returns a string value that provides a human-readable text alternative for the current value of the progress bar.
   */
  getAriaValueText?: ((formattedValue: string, value: number | null) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value.
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value.
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value. The component is indeterminate when value is `null`.
   */
  value: number | null;
}

export type ProgressRootProps<T extends ValidComponent = "div"> = ProgressRootOwnProps & RebaseUIComponentProps<T, ProgressRootState>;

export namespace ProgressRoot {
  export type State = ProgressRootState;
  export type Props<T extends ValidComponent = "div"> = ProgressRootProps<T>;
  export type OwnProps = ProgressRootOwnProps;
}

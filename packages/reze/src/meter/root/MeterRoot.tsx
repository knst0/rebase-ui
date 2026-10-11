import { clamp } from "@rebase-ui/core/clamp";
import { formatNumber } from "@rebase-ui/core/formatNumber";
import { valueToPercent } from "@rebase-ui/core/valueToPercent";
import { dynamicElement, omitProps, store, untrack, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { visuallyHidden } from "../../internals/utils/visuallyHidden";
import { MeterRootContext, useMeterRootContext } from "./MeterRootContext";

/**
 * Groups all parts of the meter and provides the value for screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Meter](https://rebase-ui.knst.dev/components/meter)
 */
export function MeterRoot<T extends JSX.ElementType = "div">(props: MeterRoot.Props<T>) {
  const labelState = store({ labelId: undefined as string | undefined });

  const min = () => props.min ?? 0;
  const max = () => props.max ?? 100;

  // `clamp` handles infinity, but NaN needs an explicit fallback before normalizing range outputs.
  function percentageValue(): number {
    const rawPercentage = valueToPercent(props.value, min(), max());
    return clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
  }

  function clampedValue(): number {
    const value = props.value;
    return clamp(Number.isNaN(value) ? min() : value, min(), max());
  }

  // Format the clamped value so visible and accessible text stay in sync with `aria-valuenow` and
  // the indicator fill. The raw value remains available as the second `getAriaValueText` argument.
  function formattedValue(): string {
    const format = props.format;
    return format
      ? formatNumber(clampedValue(), props.locale, format)
      : formatNumber(percentageValue() / 100, props.locale, { style: "percent" });
  }

  function ariaValueText(): string {
    const getAriaValueText = props.getAriaValueText;
    if (getAriaValueText) {
      return getAriaValueText(formattedValue(), props.value);
    }
    return formattedValue();
  }

  const rootState: MeterRoot.State = {};
  const contextValue: MeterRootContext = {
    formattedValue,
    labelId: () => labelState.labelId,
    percentageValue,
    setLabelId: (next) => {
      // Actions never subscribe: read the previous id untracked so a call from a
      // reactive scope does not subscribe the caller to the id it writes.
      labelState.labelId =
        typeof next === "function" ? untrack(() => (next as (prev: string | undefined) => string | undefined)(labelState.labelId)) : next;
    },
    state: rootState,
    value: () => props.value,
  };

  return (
    <MeterRootContext value={contextValue}>
      <MeterRootElement elementProps={props} min={min} max={max} clampedValue={clampedValue} ariaValueText={ariaValueText}>
        {props.children}
      </MeterRootElement>
    </MeterRootContext>
  );
}

/**
 * Renders the root element inside the meter root context. Split from `MeterRoot` so meter
 * parts are created under the context provider: reading the children getter in `MeterRoot`
 * itself would instantiate them before the provider exists (see `DialogRootContent`).
 */
function MeterRootElement<T extends JSX.ElementType>(props: MeterRootElementProps<T>) {
  const outer = props.elementProps;
  const rest = omitProps(outer, "as", "children", "format", "getAriaValueText", "locale", "max", "min", "value", "class", "style", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const meter = useMeterRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => outer.as ?? "div");

  // Spread so the attribute stays on the element: `role` on a lowercase intrinsic
  // trips the reze-lsp UNKNOWN_ATTRIBUTE false positive (see Separator.test.tsx:67).
  const presentationRole = { role: "presentation" } as const;

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="meter"
      aria-labelledby={meter.labelId()}
      aria-valuemax={props.max()}
      aria-valuemin={props.min()}
      aria-valuenow={props.clampedValue()}
      aria-valuetext={props.ariaValueText()}
      class={resolveClassValue(outer.class, meter.state)}
      style={resolveStyleValue(outer.style, meter.state)}
      ref={outer.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => meter.state)}
      {/* force NVDA to read the label https://github.com/mui/base-ui/issues/4184 */}
      <span {...presentationRole} style={visuallyHidden}>
        x
      </span>
    </Tag>
  );
}

interface MeterRootElementProps<T extends JSX.ElementType> {
  elementProps: MeterRoot.Props<T>;
  min: () => number;
  max: () => number;
  clampedValue: () => number;
  ariaValueText: () => string;
  children?: ChildrenValue<MeterRootState> | undefined;
}

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

export type MeterRootProps<T extends JSX.ElementType = "div"> = MeterRootOwnProps & RebaseUIComponentProps<T, MeterRootState>;

export namespace MeterRoot {
  export type State = MeterRootState;
  export type Props<T extends JSX.ElementType = "div"> = MeterRootProps<T>;
  export type OwnProps = MeterRootOwnProps;
}

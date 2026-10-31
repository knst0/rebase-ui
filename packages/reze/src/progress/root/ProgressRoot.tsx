import { clamp } from "@rebase-ui/core/clamp";
import { formatNumber } from "@rebase-ui/core/formatNumber";
import { valueToPercent } from "@rebase-ui/core/valueToPercent";
import { dynamicElement, omitProps, store, untrack, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { visuallyHidden } from "../../internals/utils/visuallyHidden";
import { ProgressRootContext, useProgressRootContext } from "./ProgressRootContext";

/**
 * Groups all parts of the progress bar and provides the task completion status to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Progress](https://rebase-ui.knst.dev/components/progress)
 */
export function ProgressRoot<T extends JSX.ElementType = "div">(props: ProgressRoot.Props<T>) {
  const labelState = store({ labelId: undefined as string | undefined });

  const min = () => props.min ?? 0;
  const max = () => props.max ?? 100;

  // `value === null` (or any non-finite value) keeps Progress indeterminate.
  function isDeterminate(): boolean {
    return props.value != null && Number.isFinite(props.value);
  }

  function clampedValue(): number | null {
    return isDeterminate() ? clamp(props.value as number, min(), max()) : null;
  }

  function percentageValue(): number | null {
    if (!isDeterminate()) {
      return null;
    }
    const rawPercentage = valueToPercent(props.value as number, min(), max());
    return clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
  }

  function status(): ProgressStatus {
    if (!isDeterminate()) {
      return "indeterminate";
    }
    return clampedValue() === max() ? "complete" : "progressing";
  }

  // Format the clamped value so visible and accessible text stay in sync with `aria-valuenow` and
  // the indicator fill. The raw value remains available as the second `getAriaValueText` argument.
  function formattedValue(): string {
    const clamped = clampedValue();
    if (clamped === null) {
      return "";
    }
    const format = props.format;
    return format
      ? formatNumber(clamped, props.locale, format)
      : formatNumber((percentageValue() as number) / 100, props.locale, { style: "percent" });
  }

  function ariaValueText(): string {
    const getAriaValueText = props.getAriaValueText;
    if (getAriaValueText) {
      return getAriaValueText(formattedValue(), props.value);
    }
    return isDeterminate() ? formattedValue() : "indeterminate progress";
  }

  const contextValue: ProgressRootContext = {
    formattedValue,
    labelId: () => labelState.labelId,
    percentageValue,
    setLabelId: (next) => {
      // Actions never subscribe: read the previous id untracked so a call from a
      // reactive scope does not subscribe the caller to the id it writes.
      labelState.labelId =
        typeof next === "function" ? untrack(() => (next as (prev: string | undefined) => string | undefined)(labelState.labelId)) : next;
    },
    state: () => ({ status: status() }),
    value: () => props.value,
  };

  return (
    <ProgressRootContext value={contextValue}>
      <ProgressRootElement elementProps={props} min={min} max={max} clampedValue={clampedValue} ariaValueText={ariaValueText}>
        {props.children}
      </ProgressRootElement>
    </ProgressRootContext>
  );
}

/**
 * Renders the root element inside the progress root context. Split from `ProgressRoot` so
 * parts are created under the context provider: reading the children getter in `ProgressRoot`
 * itself would instantiate them before the provider exists (see `DialogRootContent`).
 */
function ProgressRootElement<T extends JSX.ElementType>(props: ProgressRootElementProps<T>) {
  const outer = props.elementProps;
  const rest = omitProps(outer, "as", "children", "format", "getAriaValueText", "locale", "max", "min", "value", "class", "style", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const progress = useProgressRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => outer.as ?? "div");

  // Spread so the attribute stays on the element: `role` on a lowercase intrinsic
  // trips the reze-lsp UNKNOWN_ATTRIBUTE false positive (see Separator.test.tsx:67).
  const presentationRole = { role: "presentation" } as const;

  return (
    <Tag
      role="progressbar"
      aria-labelledby={progress.labelId()}
      aria-valuemax={props.max()}
      aria-valuemin={props.min()}
      aria-valuenow={props.clampedValue() ?? undefined}
      aria-valuetext={props.ariaValueText()}
      {...(rest as Record<string, unknown>)}
      data-indeterminate={progress.state().status === "indeterminate" ? "" : undefined}
      data-progressing={progress.state().status === "progressing" ? "" : undefined}
      data-complete={progress.state().status === "complete" ? "" : undefined}
      class={resolveClassValue(outer.class, progress.state())}
      style={resolveStyleValue(outer.style, progress.state())}
      ref={outer.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, progress.state)}
      {/* force NVDA to read the label https://github.com/mui/base-ui/issues/4184 */}
      <span {...presentationRole} style={visuallyHidden}>
        x
      </span>
    </Tag>
  );
}

interface ProgressRootElementProps<T extends JSX.ElementType> {
  elementProps: ProgressRoot.Props<T>;
  min: () => number;
  max: () => number;
  clampedValue: () => number | null;
  ariaValueText: () => string;
  children?: ChildrenValue<ProgressRootState> | undefined;
}

export type ProgressStatus = "indeterminate" | "progressing" | "complete";

export interface ProgressRootState {
  /**
   * The current status.
   */
  status: ProgressStatus;
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

export type ProgressRootProps<T extends JSX.ElementType = "div"> = ProgressRootOwnProps & RebaseUIComponentProps<T, ProgressRootState>;

export namespace ProgressRoot {
  export type State = ProgressRootState;
  export type Props<T extends JSX.ElementType = "div"> = ProgressRootProps<T>;
  export type OwnProps = ProgressRootOwnProps;
}

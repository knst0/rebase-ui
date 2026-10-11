import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { MeterRootState } from "../root/MeterRoot";
import { useMeterRootContext } from "../root/MeterRootContext";

/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Meter](https://rebase-ui.knst.dev/components/meter)
 */
export function MeterValue<T extends JSX.ElementType = "span">(props: MeterValue.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const meter = useMeterRootContext();

  function displayValue(): JSX.Element {
    // Zero-argument functions pass through untouched: Reze control-flow primitives return
    // thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
    if (typeof children === "function" && children.length >= 1) {
      return children(meter.formattedValue(), meter.value());
    }
    return (children ?? meter.formattedValue()) as JSX.Element;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-hidden="true"
      class={resolveClassValue(props.class, meter.state)}
      style={resolveStyleValue(props.style, meter.state)}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {displayValue()}
    </Tag>
  );
}

export interface MeterValueState extends MeterRootState {}

export type MeterValueProps<T extends JSX.ElementType = "span"> = Omit<RebaseUIComponentProps<T, MeterValueState>, "children"> & {
  children?: null | ((formattedValue: string, value: number) => JSX.Element) | undefined;
};

export namespace MeterValue {
  export type State = MeterValueState;
  export type Props<T extends JSX.ElementType = "span"> = MeterValueProps<T>;
}

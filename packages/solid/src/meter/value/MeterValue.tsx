import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { MeterRootState } from "../root/MeterRoot";
import { useMeterRootContext } from "../root/MeterRootContext";

/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Meter](https://rebase-ui.knst.dev/components/meter)
 */
export function MeterValue<T extends ValidComponent = "span">(props: MeterValue.Props<T>) {
  const [local, elementProps] = split(props as MeterValue.Props, { default: defaultProps }, ["as", "children"]);

  const as = untrack(() => local.as);

  const { formattedValue, state, value } = useMeterRootContext();

  const displayValue = () => {
    const children = local.children;
    if (typeof children === "function") {
      return (children as (formattedValue: string, value: number) => JSX.Element)(formattedValue(), value());
    }
    return children ?? formattedValue();
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        {
          "aria-hidden": "true",
          get children() {
            return displayValue();
          },
        },
        elementProps,
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "span",
} satisfies Partial<MeterValue.Props>);

export interface MeterValueState extends MeterRootState {}

export type MeterValueProps<T extends ValidComponent = "span"> = Omit<RebaseUIComponentProps<T, MeterValueState>, "children"> & {
  children?: null | ((formattedValue: string, value: number) => JSX.Element) | undefined;
};

export namespace MeterValue {
  export type State = MeterValueState;
  export type Props<T extends ValidComponent = "span"> = MeterValueProps<T>;
}

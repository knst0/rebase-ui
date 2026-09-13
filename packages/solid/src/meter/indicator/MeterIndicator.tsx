import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { mergeStyles } from "../../slider/utils/mergeStyles";
import type { MeterRootState } from "../root/MeterRoot";
import { useMeterRootContext } from "../root/MeterRootContext";

/**
 * Visualizes the position of the value along the range.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Meter](https://rebase-ui.knst.dev/components/meter)
 */
export function MeterIndicator<T extends ValidComponent = "div">(props: MeterIndicator.Props<T>) {
  const [local, elementProps] = split(props as MeterIndicator.Props, { default: defaultProps }, ["as", "style"]);

  const as = untrack(() => local.as);

  const { percentageValue, state } = useMeterRootContext();

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        elementProps,
        () => ({
          // NB: kebab-case is required. Solid applies object styles via `CSSStyleDeclaration.setProperty`,
          // which silently ignores camelCase names such as `insetInlineStart`.
          style: mergeStyles(
            state,
            {
              "inset-inline-start": 0,
              height: "inherit",
              width: `${percentageValue()}%`,
            },
            local.style,
          ),
        }),
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<MeterIndicator.Props>);

export interface MeterIndicatorState extends MeterRootState {}

export type MeterIndicatorProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, MeterIndicatorState>;

export namespace MeterIndicator {
  export type State = MeterIndicatorState;
  export type Props<T extends ValidComponent = "div"> = MeterIndicatorProps<T>;
}

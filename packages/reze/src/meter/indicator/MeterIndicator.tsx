import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { MeterRootState } from "../root/MeterRoot";
import { useMeterRootContext } from "../root/MeterRootContext";

/**
 * Visualizes the position of the value along the range.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Meter](https://rebase-ui.knst.dev/components/meter)
 */
export function MeterIndicator<T extends JSX.ElementType = "div">(props: MeterIndicator.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const meter = useMeterRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      class={resolveClassValue(props.class, meter.state)}
      style={mergeStyleValue(
        {
          // NB: kebab-case is required. Object styles are applied via `CSSStyleDeclaration.setProperty`,
          // which silently ignores camelCase names such as `insetInlineStart`.
          "inset-inline-start": "0",
          height: "inherit",
          width: `${meter.percentageValue()}%`,
        },
        resolveStyleValue(props.style, meter.state),
      )}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => meter.state)}
    </Tag>
  );
}

export interface MeterIndicatorState extends MeterRootState {}

export type MeterIndicatorProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, MeterIndicatorState>;

export namespace MeterIndicator {
  export type State = MeterIndicatorState;
  export type Props<T extends JSX.ElementType = "div"> = MeterIndicatorProps<T>;
}

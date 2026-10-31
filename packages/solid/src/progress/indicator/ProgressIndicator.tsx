import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { mergeStyles } from "../../slider/utils/mergeStyles";
import type { ProgressRootState } from "../root/ProgressRoot";
import { useProgressRootContext } from "../root/ProgressRootContext";
import { progressStateAttributesMapping } from "../root/stateAttributesMapping";

/**
 * Visualizes the completion status of the task.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Progress](https://rebase-ui.knst.dev/components/progress)
 */
export function ProgressIndicator<T extends ValidComponent = "div">(props: ProgressIndicator.Props<T>) {
  const [local, elementProps] = split(props as ProgressIndicator.Props, { default: defaultProps }, ["as", "style"]);

  const as = untrack(() => local.as);

  const { percentageValue, state } = useProgressRootContext();

  return (
    <RenderElement
      as={as}
      state={state}
      stateAttributesMapping={progressStateAttributesMapping}
      props={[
        elementProps,
        () => {
          const percentage = percentageValue();
          return {
            // NB: kebab-case is required. Solid applies object styles via `CSSStyleDeclaration.setProperty`,
            // which silently ignores camelCase names such as `insetInlineStart`.
            style: mergeStyles(
              state,
              percentage == null
                ? {}
                : {
                    "inset-inline-start": 0,
                    height: "inherit",
                    width: `${percentage}%`,
                  },
              local.style,
            ),
          };
        },
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ProgressIndicator.Props>);

export interface ProgressIndicatorState extends ProgressRootState {}

export type ProgressIndicatorProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ProgressIndicatorState>;

export namespace ProgressIndicator {
  export type State = ProgressIndicatorState;
  export type Props<T extends ValidComponent = "div"> = ProgressIndicatorProps<T>;
}

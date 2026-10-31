import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ProgressRootState } from "../root/ProgressRoot";
import { useProgressRootContext } from "../root/ProgressRootContext";
import { progressStateAttributesMapping } from "../root/stateAttributesMapping";

/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Progress](https://rebase-ui.knst.dev/components/progress)
 */
export function ProgressValue<T extends ValidComponent = "span">(props: ProgressValue.Props<T>) {
  const [local, elementProps] = split(props as ProgressValue.Props, { default: defaultProps }, ["as", "children"]);

  const as = untrack(() => local.as);

  const { formattedValue, state, value } = useProgressRootContext();

  const displayValue = () => {
    // Follow `status` rather than re-deriving it: a non-finite `value` is also indeterminate, and
    // has no formatted text to show.
    const indeterminate = state.status() === "indeterminate";
    const children = local.children;
    if (typeof children === "function") {
      return (children as (formattedValue: string | null, value: number | null) => JSX.Element)(
        indeterminate ? "indeterminate" : formattedValue(),
        value(),
      );
    }
    return indeterminate ? null : formattedValue();
  };

  return (
    <RenderElement
      as={as}
      state={state}
      stateAttributesMapping={progressStateAttributesMapping}
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
} satisfies Partial<ProgressValue.Props>);

export interface ProgressValueState extends ProgressRootState {}

export type ProgressValueProps<T extends ValidComponent = "span"> = Omit<RebaseUIComponentProps<T, ProgressValueState>, "children"> & {
  children?: null | ((formattedValue: string | null, value: number | null) => JSX.Element) | undefined;
};

export namespace ProgressValue {
  export type State = ProgressValueState;
  export type Props<T extends ValidComponent = "span"> = ProgressValueProps<T>;
}

import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ProgressRootState } from "../root/ProgressRoot";
import { useProgressRootContext } from "../root/ProgressRootContext";

/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Progress](https://rebase-ui.knst.dev/components/progress)
 */
export function ProgressValue<T extends JSX.ElementType = "span">(props: ProgressValue.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const progress = useProgressRootContext();

  function displayValue(): JSX.Element {
    // Follow `status` rather than re-deriving it: a non-finite `value` is also indeterminate, and
    // has no formatted text to show.
    const indeterminate = progress.state().status === "indeterminate";
    // Zero-argument functions pass through untouched: Reze control-flow primitives return
    // thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
    if (typeof children === "function" && children.length >= 1) {
      return children(indeterminate ? "indeterminate" : progress.formattedValue(), progress.value());
    }
    return (indeterminate ? null : progress.formattedValue()) as JSX.Element;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  return (
    <Tag
      aria-hidden="true"
      {...(rest as Record<string, unknown>)}
      data-indeterminate={progress.state().status === "indeterminate" ? "" : undefined}
      data-progressing={progress.state().status === "progressing" ? "" : undefined}
      data-complete={progress.state().status === "complete" ? "" : undefined}
      class={resolveClassValue(props.class, progress.state())}
      style={resolveStyleValue(props.style, progress.state())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {displayValue()}
    </Tag>
  );
}

export interface ProgressValueState extends ProgressRootState {}

export type ProgressValueProps<T extends JSX.ElementType = "span"> = Omit<RebaseUIComponentProps<T, ProgressValueState>, "children"> & {
  children?: null | ((formattedValue: string | null, value: number | null) => JSX.Element) | undefined;
};

export namespace ProgressValue {
  export type State = ProgressValueState;
  export type Props<T extends JSX.ElementType = "span"> = ProgressValueProps<T>;
}

import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ProgressRootState } from "../root/ProgressRoot";
import { useProgressRootContext } from "../root/ProgressRootContext";

/**
 * Visualizes the completion status of the task.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Progress](https://rebase-ui.knst.dev/components/progress)
 */
export function ProgressIndicator<T extends JSX.ElementType = "div">(props: ProgressIndicator.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const progress = useProgressRootContext();

  function indicatorStyle(): Record<string, string | undefined> {
    const percentage = progress.percentageValue();
    // NB: kebab-case is required. Object styles are applied via `CSSStyleDeclaration.setProperty`,
    // which silently ignores camelCase names such as `insetInlineStart`.
    return percentage == null ? {} : { "inset-inline-start": "0", height: "inherit", width: `${percentage}%` };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-indeterminate={progress.state().status === "indeterminate" ? "" : undefined}
      data-progressing={progress.state().status === "progressing" ? "" : undefined}
      data-complete={progress.state().status === "complete" ? "" : undefined}
      class={resolveClassValue(props.class, progress.state())}
      style={mergeStyleValue(indicatorStyle(), resolveStyleValue(props.style, progress.state()))}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, progress.state)}
    </Tag>
  );
}

export interface ProgressIndicatorState extends ProgressRootState {}

export type ProgressIndicatorProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ProgressIndicatorState>;

export namespace ProgressIndicator {
  export type State = ProgressIndicatorState;
  export type Props<T extends JSX.ElementType = "div"> = ProgressIndicatorProps<T>;
}

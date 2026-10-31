import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ProgressRootState } from "../root/ProgressRoot";
import { useProgressRootContext } from "../root/ProgressRootContext";

/**
 * Contains the progress bar indicator.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Progress](https://rebase-ui.knst.dev/components/progress)
 */
export function ProgressTrack<T extends JSX.ElementType = "div">(props: ProgressTrack.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const progress = useProgressRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-indeterminate={progress.state().status === "indeterminate" ? "" : undefined}
      data-progressing={progress.state().status === "progressing" ? "" : undefined}
      data-complete={progress.state().status === "complete" ? "" : undefined}
      class={resolveClassValue(props.class, progress.state())}
      style={resolveStyleValue(props.style, progress.state())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, progress.state)}
    </Tag>
  );
}

export interface ProgressTrackState extends ProgressRootState {}

export type ProgressTrackProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ProgressTrackState>;

export namespace ProgressTrack {
  export type State = ProgressTrackState;
  export type Props<T extends JSX.ElementType = "div"> = ProgressTrackProps<T>;
}

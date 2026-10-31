import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ProgressRootState } from "../root/ProgressRoot";
import { useProgressRootContext } from "../root/ProgressRootContext";
import { progressStateAttributesMapping } from "../root/stateAttributesMapping";

/**
 * Contains the progress bar indicator.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Progress](https://rebase-ui.knst.dev/components/progress)
 */
export function ProgressTrack<T extends ValidComponent = "div">(props: ProgressTrack.Props<T>) {
  const [local, elementProps] = split(props as ProgressTrack.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { state } = useProgressRootContext();

  return <RenderElement as={as} state={state} stateAttributesMapping={progressStateAttributesMapping} props={elementProps} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ProgressTrack.Props>);

export interface ProgressTrackState extends ProgressRootState {}

export type ProgressTrackProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ProgressTrackState>;

export namespace ProgressTrack {
  export type State = ProgressTrackState;
  export type Props<T extends ValidComponent = "div"> = ProgressTrackProps<T>;
}

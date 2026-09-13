import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { MeterRootState } from "../root/MeterRoot";
import { useMeterRootContext } from "../root/MeterRootContext";

/**
 * Contains the meter indicator and represents the entire range of the meter.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Meter](https://rebase-ui.knst.dev/components/meter)
 */
export function MeterTrack<T extends ValidComponent = "div">(props: MeterTrack.Props<T>) {
  const [local, elementProps] = split(props as MeterTrack.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { state } = useMeterRootContext();

  return <RenderElement as={as} state={state} props={elementProps} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<MeterTrack.Props>);

export interface MeterTrackState extends MeterRootState {}

export type MeterTrackProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, MeterTrackState>;

export namespace MeterTrack {
  export type State = MeterTrackState;
  export type Props<T extends ValidComponent = "div"> = MeterTrackProps<T>;
}

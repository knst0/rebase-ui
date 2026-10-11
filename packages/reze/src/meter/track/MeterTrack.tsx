import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { MeterRootState } from "../root/MeterRoot";
import { useMeterRootContext } from "../root/MeterRootContext";

/**
 * Contains the meter indicator and represents the entire range of the meter.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Meter](https://rebase-ui.knst.dev/components/meter)
 */
export function MeterTrack<T extends JSX.ElementType = "div">(props: MeterTrack.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const meter = useMeterRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      class={resolveClassValue(props.class, meter.state)}
      style={resolveStyleValue(props.style, meter.state)}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => meter.state)}
    </Tag>
  );
}

export interface MeterTrackState extends MeterRootState {}

export type MeterTrackProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, MeterTrackState>;

export namespace MeterTrack {
  export type State = MeterTrackState;
  export type Props<T extends JSX.ElementType = "div"> = MeterTrackProps<T>;
}

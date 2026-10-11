import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createRegisteredLabelId } from "../../internals/labelable-provider/createRegisteredLabelId";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { MeterRootState } from "../root/MeterRoot";
import { useMeterRootContext } from "../root/MeterRootContext";

/**
 * An accessible label for the meter.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Meter](https://rebase-ui.knst.dev/components/meter)
 */
export function MeterLabel<T extends JSX.ElementType = "span">(props: MeterLabel.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const meter = useMeterRootContext();

  const id = createRegisteredLabelId(() => props.id, meter.setLabelId);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={id()}
      role="presentation"
      class={resolveClassValue(props.class, meter.state)}
      style={resolveStyleValue(props.style, meter.state)}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => meter.state)}
    </Tag>
  );
}

export interface MeterLabelOwnProps {
  /**
   * The `id` attribute of the label.
   */
  id?: string | undefined;
}

export type MeterLabelProps<T extends JSX.ElementType = "span"> = MeterLabelOwnProps & RebaseUIComponentProps<T, MeterLabelState>;

export interface MeterLabelState extends MeterRootState {}

export namespace MeterLabel {
  export type State = MeterLabelState;
  export type Props<T extends JSX.ElementType = "span"> = MeterLabelProps<T>;
  export type OwnProps = MeterLabelOwnProps;
}

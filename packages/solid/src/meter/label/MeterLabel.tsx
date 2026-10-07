import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { createRegisteredLabelId } from "../../internals/labelable-provider";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { MeterRootState } from "../root/MeterRoot";
import { useMeterRootContext } from "../root/MeterRootContext";

/**
 * An accessible label for the meter.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Meter](https://rebase-ui.knst.dev/components/meter)
 */
export function MeterLabel<T extends ValidComponent = "span">(props: MeterLabel.Props<T>) {
  const [local, elementProps] = split(props as MeterLabel.Props, { default: defaultProps }, ["as", "id"]);

  const as = untrack(() => local.as);

  const { setLabelId, state } = useMeterRootContext();

  const id = createRegisteredLabelId(() => (typeof local.id === "string" ? local.id : undefined), setLabelId);

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        {
          get id() {
            return id();
          },
          role: "presentation",
        },
        elementProps,
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "span",
} satisfies Partial<MeterLabel.Props>);

export interface MeterLabelState extends MeterRootState {}

export type MeterLabelProps<T extends ValidComponent = "span"> = RebaseUIComponentProps<T, MeterLabelState>;

export namespace MeterLabel {
  export type State = MeterLabelState;
  export type Props<T extends ValidComponent = "span"> = MeterLabelProps<T>;
}

import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { createRegisteredLabelId } from "../../internals/labelable-provider";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useFieldsetRootContext } from "../root/FieldsetRootContext";

/**
 * An accessible label that is automatically associated with the fieldset.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Fieldset](https://rebase-ui.knst.dev/components/fieldset)
 */
export function FieldsetLegend<T extends ValidComponent = "div">(props: FieldsetLegend.Props<T>) {
  const [local, elementProps] = split(props as FieldsetLegend.Props, { default: defaultProps }, ["as", "id"]);

  const as = untrack(() => local.as);

  const { disabled, setLegendId } = useFieldsetRootContext();

  const id = createRegisteredLabelId(() => (typeof local.id === "string" ? local.id : undefined), setLegendId);

  const state: FieldsetLegendState = { disabled };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        {
          get id() {
            return id();
          },
        },
        elementProps,
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<FieldsetLegend.Props>);

export interface FieldsetLegendState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
}

export type FieldsetLegendProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, FieldsetLegendState>;

export namespace FieldsetLegend {
  export type State = FieldsetLegendState;
  export type Props<T extends ValidComponent = "div"> = FieldsetLegendProps<T>;
}

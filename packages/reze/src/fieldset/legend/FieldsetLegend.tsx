import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createRegisteredLabelId } from "../../internals/labelable-provider/createRegisteredLabelId";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useFieldsetRootContext } from "../root/FieldsetRootContext";

/**
 * An accessible label that is automatically associated with the fieldset.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Fieldset](https://rebase-ui.knst.dev/components/fieldset)
 */
export function FieldsetLegend<T extends JSX.ElementType = "div">(props: FieldsetLegend.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { disabled, setLegendId } = useFieldsetRootContext();

  const id = createRegisteredLabelId(() => (typeof props.id === "string" ? props.id : undefined), setLegendId);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={id()}
      data-disabled={disabled() ? "" : undefined}
      class={resolveClassValue(props.class, { disabled: disabled() })}
      style={resolveStyleValue(props.style, { disabled: disabled() })}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => ({ disabled: disabled() }))}
    </Tag>
  );
}

export interface FieldsetLegendState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetLegendOwnProps {
  /**
   * The `id` attribute of the legend.
   */
  id?: string | undefined;
}

export type FieldsetLegendProps<T extends JSX.ElementType = "div"> = FieldsetLegendOwnProps &
  RebaseUIComponentProps<T, FieldsetLegendState>;

export namespace FieldsetLegend {
  export type State = FieldsetLegendState;
  export type Props<T extends JSX.ElementType = "div"> = FieldsetLegendProps<T>;
  export type OwnProps = FieldsetLegendOwnProps;
}

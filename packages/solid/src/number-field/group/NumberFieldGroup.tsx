import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { stateAttributesMapping } from "../utils/stateAttributesMapping";
import type { NumberFieldRootState } from "../root/NumberFieldRoot";
import { useNumberFieldRootContext } from "../root/NumberFieldRootContext";

/**
 * Groups the input with the increment and decrement buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Number Field](https://rebase-ui.knst.dev/components/number-field)
 */
export function NumberFieldGroup<T extends ValidComponent = "div">(props: NumberFieldGroup.Props<T>) {
  const [local, elementProps] = split(props as NumberFieldGroup.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { state } = useNumberFieldRootContext();

  return (
    <RenderElement
      as={as}
      state={state}
      props={[{ role: "group" }, elementProps]}
      stateAttributesMapping={stateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<NumberFieldGroup.Props>);

export interface NumberFieldGroupState extends NumberFieldRootState {}

export type NumberFieldGroupProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, NumberFieldGroupState>;

export namespace NumberFieldGroup {
  export type State = NumberFieldGroupState;
  export type Props<T extends ValidComponent = "div"> = NumberFieldGroupProps<T>;
}

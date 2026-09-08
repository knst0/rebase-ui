import type { ValidComponent } from "@solidjs/web";
import { createMemo, untrack } from "solid-js";

import { fieldValidityMapping } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context";
import { LabelableProvider } from "../../internals/labelable-provider";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { FieldRootState } from "../root/FieldRoot";
import { FieldItemContext } from "./FieldItemContext";

/**
 * Groups a control with its label and messages inside a field.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldItem<T extends ValidComponent = "div">(props: FieldItem.Props<T>) {
  const [local, elementProps] = split(props as FieldItem.Props, { default: defaultProps }, ["as", "disabled"]);

  const as = untrack(() => local.as);

  const fieldRootContext = useFieldRootContext(false);

  const disabled = createMemo(() => fieldRootContext.disabled() === true || local.disabled === true);

  const state: FieldItemState = { ...fieldRootContext.state, disabled };

  return (
    <LabelableProvider>
      <FieldItemContext value={{ disabled }}>
        <RenderElement as={as} state={state} props={[elementProps]} stateAttributesMapping={fieldValidityMapping} />
      </FieldItemContext>
    </LabelableProvider>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
} satisfies Partial<FieldItem.Props>);

export interface FieldItemState extends FieldRootState {}

export interface FieldItemOwnProps {
  /**
   * Whether the wrapped control should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type FieldItemProps<T extends ValidComponent = "div"> = FieldItemOwnProps & RebaseUIComponentProps<T, FieldItemState>;

export namespace FieldItem {
  export type State = FieldItemState;
  export type Props<T extends ValidComponent = "div"> = FieldItemProps<T>;
  export type OwnProps = FieldItemOwnProps;
}

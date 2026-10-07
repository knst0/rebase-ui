import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createUniqueId, untrack } from "solid-js";

import { fieldValidityMapping } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context";
import { useLabelableContext } from "../../internals/labelable-provider";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useFieldItemContext } from "../item/FieldItemContext";
import type { FieldRootState } from "../root/FieldRoot";

/**
 * A paragraph with additional information about the field.
 * Renders a `<p>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldDescription<T extends ValidComponent = "p">(props: FieldDescription.Props<T>) {
  const [local, elementProps] = split(props as FieldDescription.Props, { default: defaultProps }, ["as", "id"]);

  const as = untrack(() => local.as);

  const generatedId = createUniqueId();
  const id: Accessor<string> = () => (local.id || undefined) ?? generatedId;

  const fieldRootContext = useFieldRootContext(false);
  const { setMessageIds } = useLabelableContext();
  const { disabled: itemDisabled } = useFieldItemContext();

  const disabled = createMemo(() => fieldRootContext.disabled() === true || itemDisabled());

  const state: FieldDescriptionState = {
    ...fieldRootContext.state,
    disabled,
  };

  createEffect(
    () => id(),
    (currentId) => {
      if (!currentId) {
        return;
      }

      setMessageIds((v) => v.concat(currentId));

      return () => {
        setMessageIds((v) => v.filter((item) => item !== currentId));
      };
    },
  );

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        elementProps,
        {
          get id() {
            return id();
          },
        },
      ]}
      stateAttributesMapping={fieldValidityMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "p",
} satisfies Partial<FieldDescription.Props>);

export interface FieldDescriptionState extends FieldRootState {}

export type FieldDescriptionProps<T extends ValidComponent = "p"> = RebaseUIComponentProps<T, FieldDescriptionState>;

export namespace FieldDescription {
  export type State = FieldDescriptionState;
  export type Props<T extends ValidComponent = "p"> = FieldDescriptionProps<T>;
}

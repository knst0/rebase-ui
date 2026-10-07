import type { ValidComponent } from "@solidjs/web";
import type { Setter } from "solid-js";
import { createEffect, untrack } from "solid-js";

import type { FieldRoot } from "../../field/root/FieldRoot";
import { fieldValidityMapping } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import { createLabel } from "../../internals/labelable-provider";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxRootContext } from "../root/ComboboxRootContext";

function getDefaultLabelId(id: string | null | undefined): string | undefined {
  return id == null ? undefined : `${id}-label`;
}

/**
 * An accessible label that is automatically associated with the combobox trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxLabel<T extends ValidComponent = "div">(props: ComboboxLabel.Props<T>) {
  const [local, elementProps] = split(props as ComboboxLabel.Props, { default: defaultProps }, ["as"]);
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  if ("id" in elementProps) {
    delete (elementProps as Record<string, unknown>).id;
  }

  const as = untrack(() => local.as);

  const field = useFieldRootContext();
  const store = useComboboxRootContext();

  if (process.env.NODE_ENV !== "production") {
    createEffect(
      () => ({
        inputElement: store.select("inputElement") as HTMLInputElement | null,
        inputInsidePopup: store.select("inputInsidePopup") as boolean,
      }),
      ({ inputElement, inputInsidePopup }) => {
        if (!inputElement || inputInsidePopup) {
          return;
        }
        console.error(
          "<Combobox.Label> labels <Combobox.Trigger> only. " +
            "When <Combobox.Input> is the form control, use a native <label> or <Field.Label> instead.",
        );
        return undefined;
      },
    );
  }
  const labelProps = createLabel({
    id: () => getDefaultLabelId(store.select("id") as string | undefined),
    fallbackControlId: () => {
      const triggerId = (store.peek("triggerElement") as HTMLElement | null)?.id;
      const rootId = store.peek("id") as string | undefined;
      return triggerId ?? ((store.peek("inputInsidePopup") as boolean) ? rootId : undefined);
    },
    setLabelId: ((next: string | undefined | ((prev: string | undefined) => string | undefined)) => {
      store.set("labelId", typeof next === "function" ? next(store.peek("labelId")) : next);
    }) as Setter<string | undefined>,
  });

  return <RenderElement as={as} state={field.state} props={[labelProps, elementProps]} stateAttributesMapping={fieldValidityMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ComboboxLabel.Props>);

export type ComboboxLabelState = FieldRoot.State;

export type ComboboxLabelProps<T extends ValidComponent = "div"> = Omit<RebaseUIComponentProps<T, ComboboxLabel.State>, "id">;

export namespace ComboboxLabel {
  export type State = ComboboxLabelState;
  export type Props<T extends ValidComponent = "div"> = ComboboxLabelProps<T>;
}

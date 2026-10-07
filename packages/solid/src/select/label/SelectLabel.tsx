import type { ValidComponent } from "@solidjs/web";
import type { Setter } from "solid-js";
import { untrack } from "solid-js";

import type { FieldRoot } from "../../field/root/FieldRoot";
import { fieldValidityMapping } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import { createLabel } from "../../internals/labelable-provider";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";

/**
 * An accessible label that is automatically associated with the select trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectLabel<T extends ValidComponent = "div">(props: SelectLabel.Props<T>) {
  const [local, elementProps] = split(props as SelectLabel.Props, { default: defaultProps }, ["as"]);
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  if ("id" in elementProps) {
    delete (elementProps as Record<string, unknown>).id;
  }

  const as = untrack(() => local.as);

  const field = useFieldRootContext();
  const store = useSelectRootContext();

  const labelProps = createLabel({
    id: () => {
      const rootId = store.select("id") as string | undefined;
      return rootId ? `${rootId}-label` : undefined;
    },
    fallbackControlId: () =>
      (store.peek("triggerElement") as HTMLElement | null)?.id || (store.peek("id") as string | undefined) || undefined,
    setLabelId: ((next: string | undefined | ((prev: string | undefined) => string | undefined)) => {
      store.set("labelId", typeof next === "function" ? next(store.peek("labelId")) : next);
    }) as Setter<string | undefined>,
  });

  return <RenderElement as={as} state={field.state} props={[labelProps, elementProps]} stateAttributesMapping={fieldValidityMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SelectLabel.Props>);

export type SelectLabelState = FieldRoot.State;

export type SelectLabelProps<T extends ValidComponent = "div"> = Omit<RebaseUIComponentProps<T, SelectLabel.State>, "id">;

export namespace SelectLabel {
  export type State = SelectLabelState;
  export type Props<T extends ValidComponent = "div"> = SelectLabelProps<T>;
}

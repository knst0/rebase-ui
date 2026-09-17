import type { ValidComponent } from "@solidjs/web";
import { createEffect, createUniqueId, onCleanup, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxGroupContext } from "../group/ComboboxGroupContext";

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxGroupLabel<T extends ValidComponent = "div">(props: ComboboxGroupLabel.Props<T>) {
  const [local, elementProps] = split(props as ComboboxGroupLabel.Props, { default: defaultProps }, ["as", "id"]);

  const as = untrack(() => local.as);

  const group = useComboboxGroupContext();

  const fallbackId = createUniqueId();
  const id = () => (typeof local.id === "string" ? local.id : undefined) ?? fallbackId;

  let latestId: string | undefined;

  createEffect(
    () => id(),
    (nextId) => {
      latestId = nextId;
      group.setLabelId(nextId);
      return undefined;
    },
  );

  onCleanup(() => {
    const removedId = latestId;
    group.setLabelId((currentId) => (currentId === removedId ? undefined : currentId));
  });

  return (
    <RenderElement
      as={as}
      props={[
        {
          get id() {
            return id();
          },
          "aria-hidden": "true" as const,
        },
        elementProps,
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ComboboxGroupLabel.Props>);

export interface ComboboxGroupLabelState {}

export type ComboboxGroupLabelProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ComboboxGroupLabelState>;

export namespace ComboboxGroupLabel {
  export type State = ComboboxGroupLabelState;
  export type Props<T extends ValidComponent = "div"> = ComboboxGroupLabelProps<T>;
}

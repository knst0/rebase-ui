import type { ValidComponent } from "@solidjs/web";
import { createEffect, createUniqueId, onCleanup, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectGroupContext } from "../group/SelectGroupContext";

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectGroupLabel<T extends ValidComponent = "div">(props: SelectGroupLabel.Props<T>) {
  const [local, elementProps] = split(
    props as SelectGroupLabel.Props,
    { default: defaultProps },
    ["as", "id"],
  );

  const as = untrack(() => local.as);

  const group = useSelectGroupContext();

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
} satisfies Partial<SelectGroupLabel.Props>);

export interface SelectGroupLabelState {}

export type SelectGroupLabelProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<
  T,
  SelectGroupLabelState
>;

export namespace SelectGroupLabel {
  export type State = SelectGroupLabelState;
  export type Props<T extends ValidComponent = "div"> = SelectGroupLabelProps<T>;
}

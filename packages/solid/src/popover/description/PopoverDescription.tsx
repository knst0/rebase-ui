import type { ValidComponent } from "@solidjs/web";
import { createEffect, createUniqueId, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverRootContext } from "../root/PopoverRootContext";

/**
 * A paragraph with additional information about the popover.
 * Renders a `<p>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverDescription<T extends ValidComponent = "p">(props: PopoverDescription.Props<T>) {
  const [local, elementProps] = split(props as PopoverDescription.Props, { default: defaultProps }, ["as", "id"]);

  const as = untrack(() => local.as);
  const id = untrack(() => local.id) ?? createUniqueId();

  const store = usePopoverRootContext();

  createEffect(
    () => id,
    (resolvedId) => {
      store.set("descriptionElementId", resolvedId);

      return () => {
        if (untrack(() => store.select("descriptionElementId")) === resolvedId) {
          store.set("descriptionElementId", undefined);
        }
      };
    },
  );

  return <RenderElement as={as} props={[{ id }, elementProps]} />;
}

const defaultProps = Object.freeze({
  as: "p",
} satisfies Partial<PopoverDescription.Props>);

export interface PopoverDescriptionOwnProps {
  /**
   * The `id` attribute of the description.
   */
  id?: string | undefined;
}

export type PopoverDescriptionProps<T extends ValidComponent = "p"> = PopoverDescriptionOwnProps &
  RebaseUIComponentProps<T, PopoverDescriptionState>;

export interface PopoverDescriptionState {}

export namespace PopoverDescription {
  export type State = PopoverDescriptionState;
  export type Props<T extends ValidComponent = "p"> = PopoverDescriptionProps<T>;
  export type OwnProps = PopoverDescriptionOwnProps;
}

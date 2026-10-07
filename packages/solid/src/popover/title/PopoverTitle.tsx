import type { ValidComponent } from "@solidjs/web";
import { createEffect, createUniqueId, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverRootContext } from "../root/PopoverRootContext";

/**
 * A heading that labels the popover.
 * Renders an `<h2>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverTitle<T extends ValidComponent = "h2">(props: PopoverTitle.Props<T>) {
  const [local, elementProps] = split(props as PopoverTitle.Props, { default: defaultProps }, ["as", "id"]);

  const as = untrack(() => local.as);
  const id = untrack(() => local.id) ?? createUniqueId();

  const store = usePopoverRootContext();

  createEffect(
    () => id,
    (resolvedId) => {
      store.set("titleElementId", resolvedId);

      return () => {
        if (untrack(() => store.select("titleElementId")) === resolvedId) {
          store.set("titleElementId", undefined);
        }
      };
    },
  );

  return <RenderElement as={as} props={[{ id }, elementProps]} />;
}

const defaultProps = Object.freeze({
  as: "h2",
} satisfies Partial<PopoverTitle.Props>);

export interface PopoverTitleOwnProps {
  /**
   * The `id` attribute of the title.
   */
  id?: string | undefined;
}

export type PopoverTitleProps<T extends ValidComponent = "h2"> = PopoverTitleOwnProps & RebaseUIComponentProps<T, PopoverTitleState>;

export interface PopoverTitleState {}

export namespace PopoverTitle {
  export type State = PopoverTitleState;
  export type Props<T extends ValidComponent = "h2"> = PopoverTitleProps<T>;
  export type OwnProps = PopoverTitleOwnProps;
}

import type { ValidComponent } from "@solidjs/web";
import { createEffect, createUniqueId, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogRootContext } from "../root/DialogRootContext";

/**
 * A heading that labels the dialog.
 * Renders an `<h2>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogTitle<T extends ValidComponent = "h2">(props: DialogTitle.Props<T>) {
  const [local, elementProps] = split(props as DialogTitle.Props, { default: defaultProps }, ["as", "id"]);

  const as = untrack(() => local.as);
  const id = untrack(() => local.id) ?? createUniqueId();

  const store = useDialogRootContext();

  createEffect(
    () => id,
    (resolvedId) => {
      store.setTitleElementId(resolvedId);

      return () => {
        if (untrack(store.titleElementId) === resolvedId) {
          store.setTitleElementId(undefined);
        }
      };
    },
  );

  return <RenderElement as={as} props={[{ id }, elementProps]} />;
}

const defaultProps = Object.freeze({
  as: "h2",
} satisfies Partial<DialogTitle.Props>);

export interface DialogTitleOwnProps {
  /**
   * The `id` attribute of the title.
   */
  id?: string | undefined;
}

export type DialogTitleProps<T extends ValidComponent = "h2"> = DialogTitleOwnProps & RebaseUIComponentProps<T, DialogTitleState>;

export interface DialogTitleState {}

export namespace DialogTitle {
  export type State = DialogTitleState;
  export type Props<T extends ValidComponent = "h2"> = DialogTitleProps<T>;
  export type OwnProps = DialogTitleOwnProps;
}

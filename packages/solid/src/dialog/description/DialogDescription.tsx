import type { ValidComponent } from "@solidjs/web";
import { createEffect, createUniqueId, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogRootContext } from "../root/DialogRootContext";

/**
 * A paragraph with additional information about the dialog.
 * Renders a `<p>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogDescription<T extends ValidComponent = "p">(props: DialogDescription.Props<T>) {
  const [local, elementProps] = split(props as DialogDescription.Props, { default: defaultProps }, ["as", "id"]);

  const as = untrack(() => local.as);
  const id = untrack(() => local.id) ?? createUniqueId();

  const store = useDialogRootContext();

  createEffect(
    () => id,
    (resolvedId) => {
      store.setDescriptionElementId(resolvedId);

      return () => {
        if (untrack(store.descriptionElementId) === resolvedId) {
          store.setDescriptionElementId(undefined);
        }
      };
    },
  );

  return <RenderElement as={as} props={[{ id }, elementProps]} />;
}

const defaultProps = Object.freeze({
  as: "p",
} satisfies Partial<DialogDescription.Props>);

export interface DialogDescriptionOwnProps {
  /**
   * The `id` attribute of the description.
   */
  id?: string | undefined;
}

export type DialogDescriptionProps<T extends ValidComponent = "p"> = DialogDescriptionOwnProps &
  RebaseUIComponentProps<T, DialogDescriptionState>;

export interface DialogDescriptionState {}

export namespace DialogDescription {
  export type State = DialogDescriptionState;
  export type Props<T extends ValidComponent = "p"> = DialogDescriptionProps<T>;
  export type OwnProps = DialogDescriptionOwnProps;
}

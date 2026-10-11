import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogRootContext } from "../root/DialogRootContext";

/**
 * A paragraph with additional information about the dialog.
 * Renders a `<p>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogDescription<T extends JSX.ElementType = "p">(props: DialogDescription.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const id = props.id ?? createUniqueId();

  const dialog = useDialogRootContext();

  effect(() => {
    dialog.setDescriptionElementId(id);

    onCleanup(() => {
      if (dialog.descriptionElementId() === id) {
        dialog.setDescriptionElementId(undefined);
      }
    });
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "p");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={id}
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
      ref={props.ref}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

export interface DialogDescriptionOwnProps {
  /**
   * The `id` attribute of the description.
   */
  id?: string | undefined;
}

export type DialogDescriptionProps<T extends JSX.ElementType = "p"> = DialogDescriptionOwnProps &
  RebaseUIComponentProps<T, DialogDescriptionState>;

export interface DialogDescriptionState {}

export namespace DialogDescription {
  export type State = DialogDescriptionState;
  export type Props<T extends JSX.ElementType = "p"> = DialogDescriptionProps<T>;
  export type OwnProps = DialogDescriptionOwnProps;
}

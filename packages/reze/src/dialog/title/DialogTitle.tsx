import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogRootContext } from "../root/DialogRootContext";

/**
 * A heading that labels the dialog.
 * Renders an `<h2>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogTitle<T extends JSX.ElementType = "h2">(props: DialogTitle.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const id = props.id ?? createUniqueId();

  const dialog = useDialogRootContext();

  effect(() => {
    dialog.setTitleElementId(id);

    onCleanup(() => {
      if (dialog.titleElementId() === id) {
        dialog.setTitleElementId(undefined);
      }
    });
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "h2");

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

export interface DialogTitleOwnProps {
  /**
   * The `id` attribute of the title.
   */
  id?: string | undefined;
}

export type DialogTitleProps<T extends JSX.ElementType = "h2"> = DialogTitleOwnProps & RebaseUIComponentProps<T, DialogTitleState>;

export interface DialogTitleState {}

export namespace DialogTitle {
  export type State = DialogTitleState;
  export type Props<T extends JSX.ElementType = "h2"> = DialogTitleProps<T>;
  export type OwnProps = DialogTitleOwnProps;
}

import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverRootContext } from "../root/PopoverRootContext";

/**
 * A paragraph with additional information about the popover.
 * Renders a `<p>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverDescription<T extends JSX.ElementType = "p">(props: PopoverDescription.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const id = props.id ?? createUniqueId();

  const store = usePopoverRootContext();

  effect(() => {
    store.set("descriptionElementId", id);

    onCleanup(() => {
      if (store.peek("descriptionElementId") === id) {
        store.set("descriptionElementId", undefined);
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
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

export interface PopoverDescriptionOwnProps {
  /**
   * The `id` attribute of the description.
   */
  id?: string | undefined;
}

export type PopoverDescriptionProps<T extends JSX.ElementType = "p"> = PopoverDescriptionOwnProps &
  RebaseUIComponentProps<T, PopoverDescriptionState>;

export interface PopoverDescriptionState {}

export namespace PopoverDescription {
  export type State = PopoverDescriptionState;
  export type Props<T extends JSX.ElementType = "p"> = PopoverDescriptionProps<T>;
  export type OwnProps = PopoverDescriptionOwnProps;
}

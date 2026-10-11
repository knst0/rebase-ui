import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverRootContext } from "../root/PopoverRootContext";

/**
 * A heading that labels the popover.
 * Renders an `<h2>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverTitle<T extends JSX.ElementType = "h2">(props: PopoverTitle.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const id = props.id ?? createUniqueId();

  const store = usePopoverRootContext();

  effect(() => {
    store.set("titleElementId", id);

    onCleanup(() => {
      if (store.peek("titleElementId") === id) {
        store.set("titleElementId", undefined);
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
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

export interface PopoverTitleOwnProps {
  /**
   * The `id` attribute of the title.
   */
  id?: string | undefined;
}

export type PopoverTitleProps<T extends JSX.ElementType = "h2"> = PopoverTitleOwnProps & RebaseUIComponentProps<T, PopoverTitleState>;

export interface PopoverTitleState {}

export namespace PopoverTitle {
  export type State = PopoverTitleState;
  export type Props<T extends JSX.ElementType = "h2"> = PopoverTitleProps<T>;
  export type OwnProps = PopoverTitleOwnProps;
}

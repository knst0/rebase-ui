import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";

/**
 * An icon that indicates that the trigger button opens the popup.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxIcon<T extends JSX.ElementType = "span">(props: ComboboxIcon.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  function snapshot(): ComboboxIconState {
    return {};
  }

  // `as` is resolved once: the default path renders a static `<span>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <span
        {...(rest as Record<string, unknown>)}
        aria-hidden="true"
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children === undefined ? "▼" : children, snapshot)}
      </span>
    );
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-hidden="true"
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children === undefined ? "▼" : children, snapshot)}
    </Tag>
  );
}

export interface ComboboxIconState {}

export type ComboboxIconProps<T extends JSX.ElementType = "span"> = RebaseUIComponentProps<T, ComboboxIconState>;

export namespace ComboboxIcon {
  export type State = ComboboxIconState;
  export type Props<T extends JSX.ElementType = "span"> = ComboboxIconProps<T>;
}

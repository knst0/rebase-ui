import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { Orientation, RebaseUIComponentProps } from "../../internals/types";

/**
 * A visual separator between items or groups.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxSeparator<T extends JSX.ElementType = "div">(props: ComboboxSeparator.Props<T>) {
  const rest = omitProps(props, "as", "orientation", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  function snapshot(): ComboboxSeparatorState {
    return { orientation: props.orientation ?? "horizontal" };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="separator"
        aria-orientation={props.orientation ?? "horizontal"}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="separator"
      aria-orientation={props.orientation ?? "horizontal"}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface ComboboxSeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export interface ComboboxSeparatorOwnProps {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export type ComboboxSeparatorProps<T extends JSX.ElementType = "div"> = ComboboxSeparatorOwnProps &
  RebaseUIComponentProps<T, ComboboxSeparatorState>;

export namespace ComboboxSeparator {
  export type State = ComboboxSeparatorState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxSeparatorProps<T>;
  export type OwnProps = ComboboxSeparatorOwnProps;
}

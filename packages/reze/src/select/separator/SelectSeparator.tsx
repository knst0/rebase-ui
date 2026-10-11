import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { Orientation, RebaseUIComponentProps } from "../../internals/types";

export interface SelectSeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export interface SelectSeparatorOwnProps {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export type SelectSeparatorProps<T extends JSX.ElementType = "div"> = SelectSeparatorOwnProps &
  RebaseUIComponentProps<T, SelectSeparatorState>;

/**
 * A visual separator between items or groups.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectSeparator<T extends JSX.ElementType = "div">(props: SelectSeparator.Props<T>) {
  const rest = omitProps(props, "as", "orientation", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  function orientation(): Orientation {
    return props.orientation ?? "horizontal";
  }

  function snapshot(): SelectSeparatorState {
    return { orientation: orientation() };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="separator"
        aria-orientation={orientation()}
        data-orientation={orientation()}
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
      aria-orientation={orientation()}
      data-orientation={orientation()}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export namespace SelectSeparator {
  export type State = SelectSeparatorState;
  export type Props<T extends JSX.ElementType = "div"> = SelectSeparatorProps<T>;
  export type OwnProps = SelectSeparatorOwnProps;
}

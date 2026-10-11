import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../internals/renderProps";
import type { Orientation, RebaseUIComponentProps } from "../internals/types";

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Separator](https://rebase-ui.knst.dev/components/separator)
 */
export function Separator<T extends JSX.ElementType = "div">(props: Separator.Props<T>) {
  const rest = omitProps(props, "as", "orientation", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="separator"
      aria-orientation={props.orientation ?? "horizontal"}
      class={resolveClassValue(props.class, { orientation: props.orientation ?? "horizontal" })}
      style={resolveStyleValue(props.style, { orientation: props.orientation ?? "horizontal" })}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => ({ orientation: props.orientation ?? "horizontal" }))}
    </Tag>
  );
}

export interface SeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export interface SeparatorOwnProps {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export type SeparatorProps<T extends JSX.ElementType = "div"> = SeparatorOwnProps & RebaseUIComponentProps<T, SeparatorState>;

export namespace Separator {
  export type Props<T extends JSX.ElementType = "div"> = SeparatorProps<T>;
  export type OwnProps = SeparatorOwnProps;
  export type State = SeparatorState;
}

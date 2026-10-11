import { omitProps, type JSX } from "reze-js";

import type { RebaseUIComponentProps } from "../../internals/types";
import { SelectScrollArrow } from "../scroll-arrow/SelectScrollArrow";

/**
 * An element that scrolls the select popup up when hovered. Does not render when using touch input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectScrollUpArrow<T extends JSX.ElementType = "div">(props: SelectScrollUpArrow.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted");

  return (
    <SelectScrollArrow
      {...({
        ...(rest as Record<string, unknown>),
        as: props.as ?? "div",
        direction: "up",
        keepMounted: props.keepMounted ?? false,
      } as SelectScrollArrow.Props)}
    />
  );
}

export interface SelectScrollUpArrowState {}

export interface SelectScrollUpArrowOwnProps {
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type SelectScrollUpArrowProps<T extends JSX.ElementType = "div"> = SelectScrollUpArrowOwnProps &
  RebaseUIComponentProps<T, SelectScrollUpArrowState>;

export namespace SelectScrollUpArrow {
  export type State = SelectScrollUpArrowState;
  export type Props<T extends JSX.ElementType = "div"> = SelectScrollUpArrowProps<T>;
  export type OwnProps = SelectScrollUpArrowOwnProps;
}

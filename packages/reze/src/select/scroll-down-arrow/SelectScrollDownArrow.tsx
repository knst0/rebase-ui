import { omitProps, type JSX } from "reze-js";

import type { RebaseUIComponentProps } from "../../internals/types";
import { SelectScrollArrow } from "../scroll-arrow/SelectScrollArrow";

/**
 * An element that scrolls the select popup down when hovered. Does not render when using touch input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectScrollDownArrow<T extends JSX.ElementType = "div">(props: SelectScrollDownArrow.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted");

  return (
    <SelectScrollArrow
      {...({
        ...(rest as Record<string, unknown>),
        as: props.as ?? "div",
        direction: "down",
        keepMounted: props.keepMounted ?? false,
      } as SelectScrollArrow.Props)}
    />
  );
}

export interface SelectScrollDownArrowState {}

export interface SelectScrollDownArrowOwnProps {
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type SelectScrollDownArrowProps<T extends JSX.ElementType = "div"> = SelectScrollDownArrowOwnProps &
  RebaseUIComponentProps<T, SelectScrollDownArrowState>;

export namespace SelectScrollDownArrow {
  export type State = SelectScrollDownArrowState;
  export type Props<T extends JSX.ElementType = "div"> = SelectScrollDownArrowProps<T>;
  export type OwnProps = SelectScrollDownArrowOwnProps;
}

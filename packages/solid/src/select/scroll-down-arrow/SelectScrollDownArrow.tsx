import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { SelectScrollArrow } from "../scroll-arrow/SelectScrollArrow";

/**
 * An element that scrolls the select popup down when hovered. Does not render when using touch input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectScrollDownArrow<T extends ValidComponent = "div">(props: SelectScrollDownArrow.Props<T>) {
  const [local, elementProps] = split(props as SelectScrollDownArrow.Props, { default: defaultProps }, ["as", "keepMounted"]);

  const as = untrack(() => local.as);

  return <SelectScrollArrow {...elementProps} as={as} direction="down" keepMounted={local.keepMounted} />;
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<SelectScrollDownArrow.Props>);

export interface SelectScrollDownArrowState {}

export interface SelectScrollDownArrowOwnProps {
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type SelectScrollDownArrowProps<T extends ValidComponent = "div"> = SelectScrollDownArrowOwnProps &
  RebaseUIComponentProps<T, SelectScrollDownArrowState>;

export namespace SelectScrollDownArrow {
  export type State = SelectScrollDownArrowState;
  export type Props<T extends ValidComponent = "div"> = SelectScrollDownArrowProps<T>;
  export type OwnProps = SelectScrollDownArrowOwnProps;
}

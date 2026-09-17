import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { SelectScrollArrow } from "../scroll-arrow/SelectScrollArrow";

/**
 * An element that scrolls the select popup up when hovered. Does not render when using touch input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectScrollUpArrow<T extends ValidComponent = "div">(props: SelectScrollUpArrow.Props<T>) {
  const [local, elementProps] = split(props as SelectScrollUpArrow.Props, { default: defaultProps }, ["as", "keepMounted"]);

  const as = untrack(() => local.as);

  return <SelectScrollArrow {...elementProps} as={as} direction="up" keepMounted={local.keepMounted} />;
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<SelectScrollUpArrow.Props>);

export interface SelectScrollUpArrowState {}

export interface SelectScrollUpArrowOwnProps {
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type SelectScrollUpArrowProps<T extends ValidComponent = "div"> = SelectScrollUpArrowOwnProps &
  RebaseUIComponentProps<T, SelectScrollUpArrowState>;

export namespace SelectScrollUpArrow {
  export type State = SelectScrollUpArrowState;
  export type Props<T extends ValidComponent = "div"> = SelectScrollUpArrowProps<T>;
  export type OwnProps = SelectScrollUpArrowOwnProps;
}

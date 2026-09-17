import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ComboboxRowContext } from "./ComboboxRowContext";

/**
 * Displays a single row of items in a grid list.
 * Enable `grid` on the root component to turn the listbox into a grid.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxRow<T extends ValidComponent = "div">(props: ComboboxRow.Props<T>) {
  const [local, elementProps] = split(props as ComboboxRow.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  return (
    <ComboboxRowContext value={true}>
      <RenderElement as={as} props={[{ role: "row" as const }, elementProps]} />
    </ComboboxRowContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ComboboxRow.Props>);

export interface ComboboxRowState {}

export type ComboboxRowProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ComboboxRowState>;

export namespace ComboboxRow {
  export type State = ComboboxRowState;
  export type Props<T extends ValidComponent = "div"> = ComboboxRowProps<T>;
}

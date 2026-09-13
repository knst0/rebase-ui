import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { Orientation, RebaseUIComponentProps } from "../../internals/types";

export interface SelectSeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Accessor<Orientation>;
}

export interface SelectSeparatorOwnProps {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export type SelectSeparatorProps<T extends ValidComponent = "div"> = SelectSeparatorOwnProps &
  RebaseUIComponentProps<T, SelectSeparatorState>;

/**
 * A visual separator between items or groups.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectSeparator<T extends ValidComponent = "div">(props: SelectSeparator.Props<T>) {
  const [local, elementProps] = split(
    props as SelectSeparator.Props,
    { default: defaultProps },
    ["as", "orientation"],
  );

  const as = untrack(() => local.as);

  const state: SelectSeparatorState = {
    orientation: () => local.orientation,
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        {
          role: "separator" as const,
          get "aria-orientation"() {
            return local.orientation;
          },
        },
        elementProps,
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
  orientation: "horizontal",
} satisfies Partial<SelectSeparator.Props>);

export namespace SelectSeparator {
  export type State = SelectSeparatorState;
  export type Props<T extends ValidComponent = "div"> = SelectSeparatorProps<T>;
  export type OwnProps = SelectSeparatorOwnProps;
}

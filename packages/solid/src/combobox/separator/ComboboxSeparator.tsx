import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { Orientation, RebaseUIComponentProps } from "../../internals/types";

/**
 * A visual separator between items or groups.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxSeparator<T extends ValidComponent = "div">(
  props: ComboboxSeparator.Props<T>,
) {
  const [local, elementProps] = split(
    props as ComboboxSeparator.Props,
    { default: defaultProps },
    ["as", "orientation"],
  );

  const as = untrack(() => local.as);

  const state: ComboboxSeparatorState = {
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
} satisfies Partial<ComboboxSeparator.Props>);

export interface ComboboxSeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Accessor<Orientation>;
}

export interface ComboboxSeparatorOwnProps {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export type ComboboxSeparatorProps<T extends ValidComponent = "div"> =
  ComboboxSeparatorOwnProps & RebaseUIComponentProps<T, ComboboxSeparatorState>;

export namespace ComboboxSeparator {
  export type State = ComboboxSeparatorState;
  export type Props<T extends ValidComponent = "div"> = ComboboxSeparatorProps<T>;
  export type OwnProps = ComboboxSeparatorOwnProps;
}

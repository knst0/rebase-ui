import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement } from "../internals/render-element";
import { split } from "../internals/split";
import type { Orientation, RebaseUIComponentProps } from "../internals/types";

export function Separator<T extends ValidComponent = "div">(props: Separator.Props<T>) {
  const [local, elementProps] = split(props as Separator.Props, { default: defaultProps }, ["as", "orientation"]);

  const as = untrack(() => local.as);

  const state: SeparatorState = { orientation: () => local.orientation };

  return <RenderElement as={as} state={state} props={[{ role: "separator", "aria-orientation": local.orientation }, elementProps]} />;
}

const defaultProps = Object.freeze({
  as: "div",
  orientation: "horizontal",
} satisfies Partial<Separator.Props>);

export interface SeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Accessor<Orientation>;
}

export interface SeparatorOwnProps {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export type SeparatorProps<T extends ValidComponent = "div"> = SeparatorOwnProps & RebaseUIComponentProps<T, SeparatorState>;

export namespace Separator {
  export type Props<T extends ValidComponent = "div"> = SeparatorProps<T>;
  export type OwnProps = SeparatorOwnProps;
  export type State = SeparatorState;
}

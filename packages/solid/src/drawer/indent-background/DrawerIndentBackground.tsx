import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDrawerProviderContext } from "../provider/DrawerProviderContext";

const stateAttributesMapping: StateAttributesMapping<DrawerIndentBackgroundState> = {
  active: {
    keys: ["data-active", "data-inactive"],
    map: (value): Record<string, string> | null => (value ? { "data-active": "" } : { "data-inactive": "" }),
  },
};

/**
 * An element placed before `<Drawer.Indent>` to render a background layer that can be styled based on whether any drawer is open.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerIndentBackground<T extends ValidComponent = "div">(props: DrawerIndentBackground.Props<T>) {
  const [local, elementProps] = split(props as DrawerIndentBackground.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const providerContext = useDrawerProviderContext();
  const active = () => providerContext?.active() ?? false;

  const state: DrawerIndentBackgroundState = {
    active,
  };

  return <RenderElement as={as} state={state} props={[elementProps]} stateAttributesMapping={stateAttributesMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<DrawerIndentBackground.Props>);

export interface DrawerIndentBackgroundState {
  /**
   * Whether any drawer within the nearest <Drawer.Provider> is open.
   */
  active: Accessor<boolean>;
}

export interface DrawerIndentBackgroundOwnProps {}

export type DrawerIndentBackgroundProps<T extends ValidComponent = "div"> = DrawerIndentBackgroundOwnProps &
  RebaseUIComponentProps<T, DrawerIndentBackgroundState>;

export namespace DrawerIndentBackground {
  export type State = DrawerIndentBackgroundState;
  export type Props<T extends ValidComponent = "div"> = DrawerIndentBackgroundProps<T>;
  export type OwnProps = DrawerIndentBackgroundOwnProps;
}

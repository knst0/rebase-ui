import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import * as DrawerBackdropCssVars from "../backdrop/DrawerBackdropCssVars";
import * as DrawerPopupCssVars from "../popup/DrawerPopupCssVars";
import { useDrawerProviderContext } from "../provider/DrawerProviderContext";

const stateAttributesMapping: StateAttributesMapping<DrawerIndentState> = {
  active: {
    keys: ["data-active", "data-inactive"],
    map: (value): Record<string, string> | null => (value ? { "data-active": "" } : { "data-inactive": "" }),
  },
};

/**
 * A wrapper element intended to contain your app's main UI.
 * Applies `data-active` when any drawer within the nearest `<Drawer.Provider>` is open.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerIndent<T extends ValidComponent = "div">(props: DrawerIndent.Props<T>) {
  const [local, elementProps] = split(props as DrawerIndent.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const providerContext = useDrawerProviderContext();

  const active = () => providerContext?.active() ?? false;
  const visualStateStore = providerContext?.visualStateStore;

  let indentElement: HTMLDivElement | null = null;

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, (element: HTMLDivElement | null) => {
      indentElement = element;
    }),
  });

  createEffect(
    () => visualStateStore,
    (store) => {
      const element = indentElement;
      if (!element || !store) {
        return undefined;
      }

      const syncVisualState = () => {
        const { swipeProgress, frontmostHeight } = store.getSnapshot();
        if (swipeProgress <= 0) {
          element.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
        } else {
          element.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${swipeProgress}`);
        }

        if (frontmostHeight <= 0) {
          element.style.removeProperty(DrawerPopupCssVars.height);
        } else {
          element.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight}px`);
        }
      };

      syncVisualState();

      const unsubscribe = store.subscribe(syncVisualState);
      return () => {
        unsubscribe();
        element.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
        element.style.removeProperty(DrawerPopupCssVars.height);
      };
    },
  );

  const state: DrawerIndentState = {
    active,
  };

  const indentProps = {
    style: {
      [DrawerBackdropCssVars.swipeProgress]: "0",
    },
  };

  // The indent wraps the whole app, so its children create stateful subtrees (a root
  // with trigger/portal parts). Resolve them untracked: tracked resolution would
  // re-create the subtree on every state change, discarding live drawer state.
  return (
    <RenderElement
      as={as}
      state={state}
      props={[indentProps, elementProps, refProps]}
      stateAttributesMapping={stateAttributesMapping}
      untrackChildren
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<DrawerIndent.Props>);

export interface DrawerIndentState {
  /**
   * Whether any drawer within the nearest <Drawer.Provider> is open.
   */
  active: Accessor<boolean>;
}

export interface DrawerIndentOwnProps {}

export type DrawerIndentProps<T extends ValidComponent = "div"> = DrawerIndentOwnProps & RebaseUIComponentProps<T, DrawerIndentState>;

export namespace DrawerIndent {
  export type State = DrawerIndentState;
  export type Props<T extends ValidComponent = "div"> = DrawerIndentProps<T>;
  export type OwnProps = DrawerIndentOwnProps;
}

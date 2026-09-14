import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { dialogTransitionStateMapping } from "../../dialog/utils/stateAttributesMapping";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import * as DrawerPopupCssVars from "../popup/DrawerPopupCssVars";
import * as DrawerBackdropCssVars from "./DrawerBackdropCssVars";

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerBackdrop<T extends ValidComponent = "div">(props: DrawerBackdrop.Props<T>) {
  const [local, elementProps] = split(props as DrawerBackdrop.Props, { default: defaultProps }, ["as", "forceRender"]);

  const as = untrack(() => local.as);
  const forceRender = untrack(() => local.forceRender);

  const store = useDialogRootContext();

  const state: DrawerBackdropState = {
    open: store.open,
    transitionStatus: store.transitionStatus,
  };

  const backdropProps = {
    role: "presentation" as const,
    get hidden() {
      return !store.mounted() || undefined;
    },
    get style() {
      return {
        "pointer-events": !store.open() ? "none" : undefined,
        "user-select": "none",
        "-webkit-user-select": "none",
        [DrawerBackdropCssVars.swipeProgress]: "0",
        [DrawerPopupCssVars.swipeStrength]: "1",
      } satisfies JSX.CSSProperties;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, store.setBackdropElement),
  });

  const enabled = () => forceRender || !store.nested;

  return (
    <RenderElement
      as={as}
      enabled={enabled}
      state={state}
      props={[backdropProps, elementProps, refProps]}
      stateAttributesMapping={dialogTransitionStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
  forceRender: false,
} satisfies Partial<DrawerBackdrop.Props>);

export interface DrawerBackdropState {
  /**
   * Whether the drawer is currently open.
   */
  open: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface DrawerBackdropOwnProps {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export type DrawerBackdropProps<T extends ValidComponent = "div"> = DrawerBackdropOwnProps & RebaseUIComponentProps<T, DrawerBackdropState>;

export namespace DrawerBackdrop {
  export type State = DrawerBackdropState;
  export type Props<T extends ValidComponent = "div"> = DrawerBackdropProps<T>;
  export type OwnProps = DrawerBackdropOwnProps;
}

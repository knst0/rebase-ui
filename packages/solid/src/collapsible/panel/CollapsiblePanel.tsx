import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { CollapsibleRootState } from "../root/CollapsibleRoot";
import { useCollapsibleRootContext } from "../root/CollapsibleRootContext";
import { collapsibleStateAttributesMapping } from "../root/stateAttributesMapping";
import * as CollapsiblePanelCssVars from "./CollapsiblePanelCssVars";
import { createCollapsiblePanel } from "./createCollapsiblePanel";

export function CollapsiblePanel<T extends ValidComponent = "div">(props: CollapsiblePanel.Props<T>) {
  const [local, elementProps] = split(props as CollapsiblePanel.Props, { default: defaultProps }, [
    "as",
    "hiddenUntilFound",
    "keepMounted",
    "id",
  ]);

  const as = untrack(() => local.as);
  const rootContext = useCollapsibleRootContext();

  const hiddenUntilFound = () => local.hiddenUntilFound;
  const keepMounted = () => local.keepMounted;

  if (process.env.NODE_ENV !== "production") {
    if (untrack(() => local.hiddenUntilFound) && !untrack(() => local.keepMounted)) {
      console.error(
        "Rebase UI: The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.",
      );
    }
  }

  const registeredId = untrack(() => local.id) || undefined;
  const id = registeredId ?? rootContext.defaultPanelId;

  createEffect(
    () => ({ registeredId }),
    ({ registeredId }) => {
      rootContext.setPanelIdState((currentId) => registeredId ?? (currentId === null ? undefined : currentId));

      return () => {
        rootContext.setPanelIdState((currentId) => (currentId === registeredId ? null : currentId));
      };
    },
  );

  const panel = createCollapsiblePanel({
    hiddenUntilFound,
    id: () => id,
    keepMounted,
    mounted: rootContext.mounted,
    onOpenChange: rootContext.onOpenChange,
    open: rootContext.open,
    setMounted: rootContext.setMounted,
    setOpen: rootContext.setOpen,
    transitionStatus: rootContext.transitionStatus,
  });

  const shouldRender = panel.shouldRender;

  const state: CollapsiblePanelState = {
    open: rootContext.open,
    disabled: rootContext.disabled,
    transitionStatus: panel.transitionStatus,
  };

  const dimensionsStyle = (externalProps: Record<string, any>) => ({
    style: {
      ...(externalProps.style as JSX.CSSProperties | undefined),
      [CollapsiblePanelCssVars.collapsiblePanelHeight]: panel.height() === undefined ? "auto" : `${panel.height()}px`,
      [CollapsiblePanelCssVars.collapsiblePanelWidth]: panel.width() === undefined ? "auto" : `${panel.width()}px`,
    } as JSX.CSSProperties,
  });

  const preventOpenAnimationStyle = (externalProps: Record<string, any>) =>
    panel.shouldPreventOpenAnimation()
      ? {
          style: {
            ...(externalProps.style as JSX.CSSProperties | undefined),
            animationName: "none",
          } as JSX.CSSProperties,
        }
      : ({} as Record<string, never>);

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, panel.ref),
  });

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      props={[panel.props, elementProps, dimensionsStyle, preventOpenAnimationStyle, refProps]}
      stateAttributesMapping={collapsibleStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
  hiddenUntilFound: false,
  keepMounted: false,
} satisfies Partial<CollapsiblePanel.Props>);

export interface CollapsiblePanelState extends CollapsibleRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface CollapsiblePanelOwnProps {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   *
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is hidden.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * The `id` attribute of the panel.
   */
  id?: string | undefined;
}

export type CollapsiblePanelProps<T extends ValidComponent = "div"> = CollapsiblePanelOwnProps &
  RebaseUIComponentProps<T, CollapsiblePanelState>;

export namespace CollapsiblePanel {
  export type State = CollapsiblePanelState;
  export type Props<T extends ValidComponent = "div"> = CollapsiblePanelProps<T>;
  export type OwnProps = CollapsiblePanelOwnProps;
}

import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { CollapsibleRootState } from "../root/CollapsibleRoot";
import { useCollapsibleRootContext } from "../root/CollapsibleRootContext";
import { collapsibleStateAttributesMapping } from "../root/stateAttributesMapping";
import { createCollapsiblePanel } from "./createCollapsiblePanel";

/**
 * A panel with the collapsible contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/collapsible)
 */
export function CollapsiblePanel<T extends ValidComponent = "div">(props: CollapsiblePanel.Props<T>) {
  const [local, elementProps] = split(props as CollapsiblePanel.Props, { default: defaultProps }, [
    "as",
    "hiddenUntilFound",
    "keepMounted",
    "id",
  ]);

  const as = untrack(() => local.as);
  const rootContext = useCollapsibleRootContext();

  const hiddenUntilFound = untrack(() => local.hiddenUntilFound);
  const keepMounted = untrack(() => local.keepMounted);

  if (process.env.NODE_ENV !== "production") {
    if (hiddenUntilFound && !keepMounted) {
      console.error(
        "Rebase UI: The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.",
      );
    }
  }

  const registeredId = untrack(() => local.id) || undefined;
  const id = untrack(() => registeredId ?? rootContext.panelId());

  createEffect(
    () => ({ panelId: id }),
    ({ panelId }: { panelId: string }) => {
      rootContext.setPanelId(panelId);
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

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, panel.setPanelElement),
  });

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      props={[panel.props, elementProps, refProps]}
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

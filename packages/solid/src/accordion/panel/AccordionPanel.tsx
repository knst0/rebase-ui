import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, untrack } from "solid-js";

import { createCollapsiblePanel } from "../../collapsible/panel/createCollapsiblePanel";
import { useCollapsibleRootContext } from "../../collapsible/root/CollapsibleRootContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { AccordionItemState } from "../item/AccordionItem";
import { useAccordionItemContext } from "../item/AccordionItemContext";
import { accordionStateAttributesMapping } from "../item/stateAttributesMapping";
import { useAccordionRootContext } from "../root/AccordionRootContext";
import * as AccordionPanelCssVars from "./AccordionPanelCssVars";

const panelStateAttributesMapping = accordionStateAttributesMapping as StateAttributesMapping<AccordionPanelState>;

/**
 * A collapsible panel with the accordion item contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/accordion)
 */
export function AccordionPanel<T extends ValidComponent = "div">(props: AccordionPanel.Props<T>) {
  const [local, elementProps] = split(props as AccordionPanel.Props, { default: defaultProps }, [
    "as",
    "hiddenUntilFound",
    "id",
    "keepMounted",
  ]);

  const as = untrack(() => local.as);

  const rootContext = useAccordionRootContext();

  const collapsibleContext = useCollapsibleRootContext();

  const { state: itemState, triggerId } = useAccordionItemContext();

  const hiddenUntilFound = () => local.hiddenUntilFound ?? rootContext.hiddenUntilFound();
  const keepMounted = () => local.keepMounted ?? rootContext.keepMounted();

  if (process.env.NODE_ENV !== "production") {
    if (untrack(() => local.keepMounted) === false && untrack(hiddenUntilFound)) {
      console.error(
        "Rebase UI: The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.",
      );
    }
  }

  const id = untrack(() => local.id) ?? untrack(() => collapsibleContext.panelId());

  createEffect(
    () => ({ panelId: id }),
    ({ panelId }: { panelId: string }) => {
      collapsibleContext.setPanelId(panelId);
    },
  );

  const panel = createCollapsiblePanel({
    hiddenUntilFound,
    id: () => id,
    keepMounted,
    mounted: collapsibleContext.mounted,
    onOpenChange: collapsibleContext.onOpenChange,
    open: collapsibleContext.open,
    setMounted: collapsibleContext.setMounted,
    setOpen: collapsibleContext.setOpen,
    transitionStatus: collapsibleContext.transitionStatus,
  });

  const state: AccordionPanelState = {
    ...itemState,
    transitionStatus: panel.transitionStatus,
  };

  const ariaAndStyleProps = (externalProps: Record<string, any>) => ({
    get "aria-labelledby"() {
      return triggerId();
    },
    role: "region" as const,
    style: {
      ...(externalProps.style as JSX.CSSProperties | undefined),
      [AccordionPanelCssVars.accordionPanelHeight]: panel.height() === undefined ? "auto" : `${panel.height()}px`,
      [AccordionPanelCssVars.accordionPanelWidth]: panel.width() === undefined ? "auto" : `${panel.width()}px`,
    } as JSX.CSSProperties,
  });

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, panel.ref),
  });

  return (
    <RenderElement
      as={as}
      enabled={panel.shouldRender}
      state={state}
      props={[panel.props, ariaAndStyleProps, elementProps, refProps]}
      stateAttributesMapping={panelStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<AccordionPanel.Props>);

export interface AccordionPanelState extends AccordionItemState {
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface AccordionPanelOwnProps {
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
   *
   * Defaults to the `keepMounted` prop of the root.
   */
  keepMounted?: boolean | undefined;
  /**
   * The `id` attribute of the panel.
   */
  id?: string | undefined;
}

export type AccordionPanelProps<T extends ValidComponent = "div"> = AccordionPanelOwnProps & RebaseUIComponentProps<T, AccordionPanelState>;

export namespace AccordionPanel {
  export type State = AccordionPanelState;
  export type Props<T extends ValidComponent = "div"> = AccordionPanelProps<T>;
  export type OwnProps = AccordionPanelOwnProps;
}

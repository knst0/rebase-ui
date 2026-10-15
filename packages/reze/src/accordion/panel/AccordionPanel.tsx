import { dynamicElement, effect, omitProps, type JSX } from "reze-js";

import { createCollapsiblePanel } from "../../collapsible/panel/createCollapsiblePanel";
import { useCollapsibleRootContext } from "../../collapsible/root/CollapsibleRootContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { AccordionItemState } from "../item/AccordionItem";
import { useAccordionItemContext } from "../item/AccordionItemContext";
import { useAccordionRootContext } from "../root/AccordionRootContext";
import * as AccordionPanelCssVars from "./AccordionPanelCssVars";

/**
 * A collapsible panel with the accordion item contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/accordion)
 */
export function AccordionPanel<T extends JSX.ElementType = "div">(props: AccordionPanel.Props<T>) {
  const rest = omitProps(props, "as", "hiddenUntilFound", "keepMounted", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const root = useAccordionRootContext();

  const collapsible = useCollapsibleRootContext();

  const { state: itemState, triggerId } = useAccordionItemContext();

  const hiddenUntilFound = props.hiddenUntilFound ?? root.hiddenUntilFound;
  const keepMounted = props.keepMounted ?? root.keepMounted;

  if (process.env.NODE_ENV !== "production") {
    if (props.keepMounted === false && hiddenUntilFound) {
      console.error(
        "Rebase UI: The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.",
      );
    }
  }

  const id = props.id ?? collapsible.panelId();

  effect(() => {
    collapsible.setPanelId(id);
  });

  const panel = createCollapsiblePanel({
    hiddenUntilFound,
    id: () => id,
    keepMounted,
    mounted: collapsible.mounted,
    onOpenChange: collapsible.onOpenChange,
    open: collapsible.open,
    setMounted: collapsible.setMounted,
    setOpen: collapsible.setOpen,
    transitionStatus: collapsible.transitionStatus,
  });

  function snapshot(): AccordionPanelState {
    return {
      value: itemState.value(),
      disabled: itemState.disabled(),
      hidden: itemState.hidden(),
      index: itemState.index(),
      open: itemState.open(),
      transitionStatus: panel.transitionStatus(),
    };
  }

  // Closed `hiddenUntilFound` panels keep their starting styles so the browser
  // can measure a found match. The Solid layer additionally skips the persist
  // for CSS-animated panels; the animation type stays inside
  // `createCollapsiblePanel` here, so this read covers the unmounted case only.
  function shouldPersistHiddenTransitionStyles(): boolean {
    return hiddenUntilFound && !collapsible.open() && !collapsible.mounted();
  }

  function style(): string | JSX.CSSProperties | undefined {
    return mergeStyleValue(
      {
        [AccordionPanelCssVars.accordionPanelHeight]: panel.height() === undefined ? "auto" : `${panel.height()}px`,
        [AccordionPanelCssVars.accordionPanelWidth]: panel.width() === undefined ? "auto" : `${panel.width()}px`,
      },
      resolveStyleValue(props.style, snapshot()),
    );
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would restart the panel's transitions.
  // The default path renders a static `<div>` so updates patch it in place;
  // only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {panel.shouldRender() && (
          <div
            {...(rest as Record<string, unknown>)}
            hidden={!collapsible.open() && !collapsible.mounted() ? (hiddenUntilFound ? "until-found" : true) : undefined}
            id={id}
            role="region"
            aria-labelledby={triggerId()}
            data-open={collapsible.open() ? "" : undefined}
            data-closed={collapsible.open() ? undefined : ""}
            data-index={String(itemState.index())}
            data-disabled={itemState.disabled() ? "" : undefined}
            data-hidden={itemState.hidden() ? "" : undefined}
            data-starting-style={panel.transitionStatus() === "starting" || shouldPersistHiddenTransitionStyles() ? "" : undefined}
            data-ending-style={panel.transitionStatus() === "ending" ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={style()}
            ref={mergeRefs(panel.setPanelElement, props.ref as ((element: HTMLElement | null) => void) | undefined)}
          >
            {resolveChildrenValue(children, snapshot)}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {panel.shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          hidden={!collapsible.open() && !collapsible.mounted() ? (hiddenUntilFound ? "until-found" : true) : undefined}
          id={id}
          role="region"
          aria-labelledby={triggerId()}
          data-open={collapsible.open() ? "" : undefined}
          data-closed={collapsible.open() ? undefined : ""}
          data-index={String(itemState.index())}
          data-disabled={itemState.disabled() ? "" : undefined}
          data-hidden={itemState.hidden() ? "" : undefined}
          data-starting-style={panel.transitionStatus() === "starting" || shouldPersistHiddenTransitionStyles() ? "" : undefined}
          data-ending-style={panel.transitionStatus() === "ending" ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={style()}
          ref={mergeRefs(panel.setPanelElement, props.ref as ((element: HTMLElement | null) => void) | undefined)}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface AccordionPanelState extends AccordionItemState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
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

export type AccordionPanelProps<T extends JSX.ElementType = "div"> = AccordionPanelOwnProps &
  RebaseUIComponentProps<T, AccordionPanelState>;

export namespace AccordionPanel {
  export type State = AccordionPanelState;
  export type Props<T extends JSX.ElementType = "div"> = AccordionPanelProps<T>;
  export type OwnProps = AccordionPanelOwnProps;
}

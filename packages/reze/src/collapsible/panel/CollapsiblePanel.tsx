import { dynamicElement, effect, omitProps, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useCollapsibleRootContext } from "../root/CollapsibleRootContext";
import { createCollapsiblePanel } from "./createCollapsiblePanel";

/**
 * A panel with the collapsible contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/collapsible)
 */
export function CollapsiblePanel<T extends JSX.ElementType = "div">(props: CollapsiblePanel.Props<T>) {
  const rest = omitProps(props, "as", "hiddenUntilFound", "keepMounted", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const root = useCollapsibleRootContext();

  const hiddenUntilFound = props.hiddenUntilFound ?? false;
  const keepMounted = props.keepMounted ?? false;

  if (process.env.NODE_ENV !== "production") {
    if (hiddenUntilFound && !keepMounted) {
      console.error(
        "Rebase UI: The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.",
      );
    }
  }

  const id = props.id || root.panelId();

  effect(() => {
    root.setPanelId(id);
  });

  const panel = createCollapsiblePanel({
    hiddenUntilFound,
    id: () => id,
    keepMounted,
    mounted: root.mounted,
    onOpenChange: root.onOpenChange,
    open: root.open,
    setMounted: root.setMounted,
    setOpen: root.setOpen,
    transitionStatus: root.transitionStatus,
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <>
      {panel.shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          hidden={!root.open() && !root.mounted() ? (hiddenUntilFound ? "until-found" : true) : undefined}
          id={id}
          data-open={root.open() ? "" : undefined}
          data-closed={root.open() ? undefined : ""}
          data-starting-style={panel.transitionStatus() === "starting" ? "" : undefined}
          data-ending-style={panel.transitionStatus() === "ending" ? "" : undefined}
          class={resolveClassValue(props.class, {
            open: root.open(),
            disabled: root.disabled(),
            transitionStatus: panel.transitionStatus(),
          })}
          style={resolveStyleValue(props.style, {
            open: root.open(),
            disabled: root.disabled(),
            transitionStatus: panel.transitionStatus(),
          })}
          ref={mergeRefs(panel.setPanelElement, props.ref as ((element: HTMLElement | null) => void) | undefined)}
        >
          {resolveChildrenValue(children, () => ({
            open: root.open(),
            disabled: root.disabled(),
            transitionStatus: panel.transitionStatus(),
          }))}
        </Tag>
      )}
    </>
  );
}

export interface CollapsiblePanelState {
  /**
   * Whether the collapsible panel is currently open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
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

export type CollapsiblePanelProps<T extends JSX.ElementType = "div"> = CollapsiblePanelOwnProps &
  RebaseUIComponentProps<T, CollapsiblePanelState>;

export namespace CollapsiblePanel {
  export type State = CollapsiblePanelState;
  export type Props<T extends JSX.ElementType = "div"> = CollapsiblePanelProps<T>;
  export type OwnProps = CollapsiblePanelOwnProps;
}

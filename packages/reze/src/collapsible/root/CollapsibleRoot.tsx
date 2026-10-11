import { dynamicElement, getOwner, omitProps, runWithOwner, type JSX } from "reze-js";

import { REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { accessBoolean, type ReactiveBoolean } from "../../internals/maybeAccessor";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { stableCallback } from "../../internals/stableCallback";
import type { TransitionStatus } from "../../internals/transition-status";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { CollapsibleRootContext, useCollapsibleRootContext } from "./CollapsibleRootContext";
import { createCollapsibleRoot } from "./createCollapsibleRoot";

/**
 * Groups all parts of the collapsible.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/collapsible)
 */
export function CollapsibleRoot<T extends JSX.ElementType = "div">(props: CollapsibleRoot.Props<T>) {
  const rest = omitProps(props, "as", "open", "defaultOpen", "disabled", "onOpenChange", "class", "style", "children", "ref");

  const onOpenChange = stableCallback(() => props.onOpenChange);

  const collapsible = createCollapsibleRoot({
    open: () => (props.open === undefined ? undefined : accessBoolean(props.open)),
    defaultOpen: () => props.defaultOpen ?? false,
    onOpenChange,
    disabled: () => props.disabled,
  });

  const contextValue: CollapsibleRootContext = {
    ...collapsible,
    onOpenChange,
    state: {
      open: collapsible.open,
      disabled: collapsible.disabled,
      transitionStatus: collapsible.transitionStatus,
    },
  };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the collapsible parts without context. Children
  // resolve in CollapsibleRootContent below so they are created inside the provider.
  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-open={collapsible.open() ? "" : undefined}
      data-closed={collapsible.open() ? undefined : ""}
      data-starting-style={collapsible.transitionStatus() === "starting" ? "" : undefined}
      data-ending-style={collapsible.transitionStatus() === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, {
        open: collapsible.open(),
        disabled: collapsible.disabled(),
        transitionStatus: collapsible.transitionStatus(),
      })}
      style={resolveStyleValue(props.style, {
        open: collapsible.open(),
        disabled: collapsible.disabled(),
        transitionStatus: collapsible.transitionStatus(),
      })}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <CollapsibleRootContext value={contextValue}>
        <CollapsibleRootContent>{props.children}</CollapsibleRootContent>
      </CollapsibleRootContext>
    </Tag>
  );
}

/**
 * Resolves the root children inside the collapsible context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function CollapsibleRootContent(props: { children: ChildrenValue<CollapsibleRootState> }) {
  const children = props.children;

  const { open, disabled, transitionStatus } = useCollapsibleRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: CollapsibleRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the collapsible context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: CollapsibleRootState = { open: open(), disabled: disabled(), transitionStatus: transitionStatus() };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface CollapsibleRootState {
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

export interface CollapsibleRootOwnProps {
  /**
   * Whether the collapsible panel is currently open.
   *
   * To render an uncontrolled collapsible, use the `defaultOpen` prop instead.
   */
  open?: ReactiveBoolean | undefined;
  /**
   * Whether the collapsible panel is initially open.
   *
   * To render a controlled collapsible, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void) | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: ReactiveBoolean | undefined;
}

export type CollapsibleRootProps<T extends JSX.ElementType = "div"> = CollapsibleRootOwnProps &
  RebaseUIComponentProps<T, CollapsibleRootState>;

export type CollapsibleRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type CollapsibleRootChangeEventDetails = RebaseUIChangeEventDetails<CollapsibleRootChangeEventReason>;

export namespace CollapsibleRoot {
  export type State = CollapsibleRootState;
  export type Props<T extends JSX.ElementType = "div"> = CollapsibleRootProps<T>;
  export type OwnProps = CollapsibleRootOwnProps;
  export type ChangeEventReason = CollapsibleRootChangeEventReason;
  export type ChangeEventDetails = CollapsibleRootChangeEventDetails;
}

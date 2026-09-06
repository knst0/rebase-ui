import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { CollapsibleRootContext } from "./CollapsibleRootContext";
import { createCollapsibleRoot } from "./createCollapsibleRoot";
import { collapsibleStateAttributesMapping } from "./stateAttributesMapping";

/**
 * Groups all parts of the collapsible.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/collapsible)
 */
export function CollapsibleRoot<T extends ValidComponent = "div">(props: CollapsibleRoot.Props<T>) {
  const [local, elementProps] = split(props as CollapsibleRoot.Props, { default: defaultProps }, [
    "as",
    "open",
    "defaultOpen",
    "disabled",
    "onOpenChange",
  ]);

  const as = untrack(() => local.as);

  const disabled = () => local.disabled;

  const contextValue = createCollapsibleRoot({
    defaultOpen: () => local.defaultOpen,
    disabled,
    onOpenChange: local.onOpenChange,
    open: () => local.open,
  });

  const state = contextValue.state;

  return (
    <CollapsibleRootContext value={contextValue}>
      <RenderElement as={as} state={state} props={[elementProps]} stateAttributesMapping={collapsibleStateAttributesMapping} />
    </CollapsibleRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  defaultOpen: false,
  disabled: false,
} satisfies Partial<CollapsibleRoot.Props>);

export interface CollapsibleRootState {
  /**
   * Whether the collapsible panel is currently open.
   */
  open: Accessor<boolean>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface CollapsibleRootOwnProps {
  /**
   * Whether the collapsible panel is currently open.
   *
   * To render an uncontrolled collapsible, use the `defaultOpen` prop instead.
   */
  open?: boolean | undefined;
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
  disabled?: boolean | undefined;
}

export type CollapsibleRootProps<T extends ValidComponent = "div"> = CollapsibleRootOwnProps &
  RebaseUIComponentProps<T, CollapsibleRootState>;

export type CollapsibleRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type CollapsibleRootChangeEventDetails = RebaseUIChangeEventDetails<CollapsibleRootChangeEventReason>;

export namespace CollapsibleRoot {
  export type State = CollapsibleRootState;
  export type Props<T extends ValidComponent = "div"> = CollapsibleRootProps<T>;
  export type OwnProps = CollapsibleRootOwnProps;
  export type ChangeEventReason = CollapsibleRootChangeEventReason;
  export type ChangeEventDetails = CollapsibleRootChangeEventDetails;
}

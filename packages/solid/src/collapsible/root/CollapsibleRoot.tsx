import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, createSignal, createUniqueId, untrack } from "solid-js";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { CollapsibleRootContext } from "./CollapsibleRootContext";
import { collapsibleStateAttributesMapping } from "./stateAttributesMapping";

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

  const [open, setOpen] = createControllableSignal({
    value: () => local.open,
    defaultValue: () => local.defaultOpen,
    onChange: () => {},
  });

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open, true, true);

  const defaultPanelId = createUniqueId();

  // `undefined` uses the initial generated fallback; `null` means the panel unmounted.
  const [registeredPanelId, setRegisteredPanelId] = createSignal<string | null | undefined>(undefined);

  const panelId = createMemo(() => {
    const registeredId = registeredPanelId();
    return registeredId === null ? undefined : (registeredId ?? defaultPanelId);
  });

  const setPanelIdState = (update: (currentId: string | null | undefined) => string | null | undefined) => {
    setRegisteredPanelId(update);
  };

  const onOpenChange = (nextOpen: boolean, eventDetails: CollapsibleRootChangeEventDetails) => {
    local.onOpenChange?.(nextOpen, eventDetails);
  };

  const handleTrigger = (event: MouseEvent | KeyboardEvent) => {
    const nextOpen = !untrack(open);
    const eventDetails = createChangeEventDetails(REASONS.triggerPress, event);

    onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setOpen(nextOpen);
  };

  const state: CollapsibleRootState = {
    open,
    disabled,
    transitionStatus,
  };

  const contextValue: CollapsibleRootContext = {
    defaultPanelId,
    disabled,
    handleTrigger,
    mounted,
    onOpenChange,
    open,
    panelId,
    setMounted,
    setOpen,
    setPanelIdState,
    state,
    transitionStatus,
  };

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

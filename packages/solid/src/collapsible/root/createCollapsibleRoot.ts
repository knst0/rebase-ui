import { type Accessor, createSignal, createUniqueId, type Setter, untrack } from "solid-js";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { accessBoolean, type ReactiveBoolean } from "../../internals/maybeAccessor";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { CollapsibleRoot } from "./CollapsibleRoot";

export interface CreateCollapsibleRootParameters {
  disabled?: ReactiveBoolean | undefined;
  defaultOpen?: boolean | undefined;
  open: Accessor<boolean | undefined>;
  onOpenChange?: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
}

export interface CreateCollapsibleRootReturnValue {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  handleTrigger: (event: MouseEvent | KeyboardEvent) => void;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: Accessor<boolean>;
  setMounted: Setter<boolean>;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: Accessor<boolean>;
  setOpen: (open: boolean) => void;
  panelId: Accessor<string>;
  setPanelId: Setter<string>;
  transitionStatus: Accessor<TransitionStatus>;
}

export function createCollapsibleRoot(parameters: CreateCollapsibleRootParameters): CreateCollapsibleRootReturnValue {
  const { onOpenChange } = parameters;
  const disabled = () => accessBoolean(parameters.disabled);
  const [open, setOpen] = createControllableSignal({ value: parameters.open, defaultValue: () => parameters.defaultOpen ?? false });
  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open, { enableIdleState: true, deferEndingState: true });
  const [panelId, setPanelId] = createSignal(createUniqueId());

  const handleOpenChange = (nextOpen: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => {
    onOpenChange?.(nextOpen, eventDetails);
  };

  const handleTrigger = (event: MouseEvent | KeyboardEvent) => {
    const nextOpen = !untrack(open);
    const eventDetails = createChangeEventDetails(REASONS.triggerPress, event);

    handleOpenChange(nextOpen, eventDetails);

    if (!eventDetails.isCanceled) {
      setOpen(nextOpen);
    }
  };

  return {
    disabled,
    handleTrigger,
    mounted,
    open,
    panelId,
    setMounted,
    setOpen,
    setPanelId,
    transitionStatus,
  };
}

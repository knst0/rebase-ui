import { type Accessor, createSignal, createUniqueId, type Setter, untrack } from "solid-js";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { CollapsibleRootChangeEventDetails, CollapsibleRootState } from "./CollapsibleRoot";

export interface CreateCollapsibleRootParameters {
  disabled: Accessor<boolean>;
  defaultOpen: Accessor<boolean | undefined>;
  open: Accessor<boolean | undefined>;
  onOpenChange?: (open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void;
}

export interface CreateCollapsibleRootReturnValue {
  disabled: Accessor<boolean>;
  handleTrigger: (event: MouseEvent | KeyboardEvent) => void;
  mounted: Accessor<boolean>;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void;
  open: Accessor<boolean>;
  panelId: Accessor<string>;
  setMounted: Setter<boolean>;
  setOpen: (open: boolean) => void;
  setPanelId: Setter<string>;
  state: CollapsibleRootState;
  transitionStatus: Accessor<TransitionStatus>;
}

export function createCollapsibleRoot(parameters: CreateCollapsibleRootParameters): CreateCollapsibleRootReturnValue {
  const { disabled, onOpenChange } = parameters;
  const [open, setOpen] = createControllableSignal({ value: parameters.open, defaultValue: () => parameters.defaultOpen() ?? false });
  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open, { enableIdleState: true, deferEndingState: true });
  const [panelId, setPanelId] = createSignal(createUniqueId());

  const handleOpenChange = (nextOpen: boolean, eventDetails: CollapsibleRootChangeEventDetails) => {
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

  const state: CollapsibleRootState = { open, disabled, transitionStatus };

  return {
    disabled,
    handleTrigger,
    mounted,
    onOpenChange: handleOpenChange,
    open,
    panelId,
    setMounted,
    setOpen,
    setPanelId,
    state,
    transitionStatus,
  };
}

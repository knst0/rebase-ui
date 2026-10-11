import { createUniqueId, store, untrack } from "reze-js";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { accessBoolean, type ReactiveBoolean } from "../../internals/maybeAccessor";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { CollapsibleRoot } from "./CollapsibleRoot";

export interface CreateCollapsibleRootParameters {
  disabled: () => ReactiveBoolean | undefined;
  defaultOpen: () => boolean;
  open: () => boolean | undefined;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
}

export interface CreateCollapsibleRootReturnValue {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: () => boolean;
  handleTrigger: (event: MouseEvent | KeyboardEvent) => void;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: () => boolean;
  setMounted: (mounted: boolean) => void;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: () => boolean;
  setOpen: (open: boolean) => void;
  panelId: () => string;
  setPanelId: (panelId: string) => void;
  transitionStatus: () => TransitionStatus;
}

export function createCollapsibleRoot(parameters: CreateCollapsibleRootParameters): CreateCollapsibleRootReturnValue {
  const state = store({
    mounted: false,
    transitionStatus: undefined as TransitionStatus,
    panelId: createUniqueId(),
  });

  function disabled(): boolean {
    return accessBoolean(parameters.disabled());
  }

  const [open, setOpen] = createControllableSignal({ value: parameters.open, defaultValue: parameters.defaultOpen });

  function mounted(): boolean {
    return state.mounted;
  }

  function setMounted(next: boolean): void {
    if (state.mounted !== next) {
      state.mounted = next;
    }
  }

  function transitionStatus(): TransitionStatus {
    return state.transitionStatus;
  }

  function setTransitionStatus(next: TransitionStatus): void {
    if (state.transitionStatus !== next) {
      state.transitionStatus = next;
    }
  }

  function panelId(): string {
    return state.panelId;
  }

  function setPanelId(next: string): void {
    state.panelId = next;
  }

  createTransitionStatus({
    open,
    mounted,
    transitionStatus,
    setMounted,
    setTransitionStatus,
    enableIdleState: true,
    deferEndingState: true,
  });

  function handleTrigger(event: MouseEvent | KeyboardEvent): void {
    const nextOpen = !untrack(open);
    const eventDetails = createChangeEventDetails(REASONS.triggerPress, event);

    parameters.onOpenChange(nextOpen, eventDetails);

    if (!eventDetails.isCanceled) {
      setOpen(nextOpen);
    }
  }

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

import type { Accessor, Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { TransitionStatus } from "../../internals/transition-status";
import type { CollapsibleRootChangeEventDetails, CollapsibleRootState } from "./CollapsibleRoot";

export interface CollapsibleRootContext {
  /**
   * The fallback `id` attribute of the panel.
   */
  defaultPanelId: string;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * Toggles the collapsible open state when the trigger is activated.
   */
  handleTrigger: (event: MouseEvent | KeyboardEvent) => void;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: Accessor<boolean>;
  /**
   * Invokes the root's `onOpenChange` handler.
   */
  onOpenChange: (open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: Accessor<boolean>;
  /**
   * The `id` attribute of the panel.
   */
  panelId: Accessor<string | undefined>;
  setMounted: Setter<boolean>;
  setOpen: (open: boolean) => void;
  setPanelIdState: (update: (currentId: string | null | undefined) => string | null | undefined) => void;
  state: CollapsibleRootState;
  transitionStatus: Accessor<TransitionStatus>;
}

export const CollapsibleRootContext = createContext<CollapsibleRootContext>();

export function useCollapsibleRootContext(): CollapsibleRootContext {
  const context = useContext(CollapsibleRootContext);

  if (context === undefined) {
    throw new Error("Rebase UI: CollapsibleRootContext is missing. Collapsible parts must be placed within <Collapsible.Root>.");
  }

  return context;
}

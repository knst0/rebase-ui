import type { VirtualElement } from "@floating-ui/dom";
import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";

export interface ContextMenuRootContext {
  anchor: Accessor<VirtualElement>;
  setAnchor: (anchor: VirtualElement) => void;
  backdropElement: HTMLElement | null;
  internalBackdropElement: HTMLElement | null;
  allowMouseUpTriggerRef: { current: boolean };
  initialCursorPoint: { x: number; y: number } | null;
}

export const ContextMenuRootContext = createContext<ContextMenuRootContext>();

export function useContextMenuRootContext(optional: false): ContextMenuRootContext;
export function useContextMenuRootContext(optional?: true): ContextMenuRootContext | undefined;
export function useContextMenuRootContext(optional = true): ContextMenuRootContext | undefined {
  const context = useContext(ContextMenuRootContext);

  if (context === undefined && !optional) {
    throw new Error("Rebase UI: ContextMenuRootContext is missing. ContextMenu parts must be placed within <ContextMenu.Root>.");
  }

  return context;
}

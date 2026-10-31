import type { VirtualElement } from "@floating-ui/dom";
import { createContext, useContext } from "reze-js";

export interface ContextMenuRootContext {
  anchor: () => VirtualElement;
  setAnchor: (anchor: VirtualElement) => void;
  backdropElement: HTMLElement | null;
  internalBackdropElement: HTMLElement | null;
  allowMouseUpTriggerRef: { current: boolean };
  initialCursorPoint: { x: number; y: number } | null;
}

export const ContextMenuRootContext = createContext<ContextMenuRootContext | undefined>(undefined);

export function useContextMenuRootContext(optional: false): ContextMenuRootContext;
export function useContextMenuRootContext(optional?: true): ContextMenuRootContext | undefined;
export function useContextMenuRootContext(optional = true): ContextMenuRootContext | undefined {
  const context = useContext(ContextMenuRootContext);

  if (context === undefined && !optional) {
    throw new Error("Rebase UI: ContextMenuRootContext is missing. ContextMenu parts must be placed within <ContextMenu.Root>.");
  }

  return context;
}

import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { RebaseUIChangeEventDetails } from "../../internals/event-details";
import type { TransitionStatus } from "../../internals/transition-status";
import type { NavigationMenuRoot } from "./NavigationMenuRoot";

export interface NavigationMenuPopupAutoSizeResetState {
  abortController: AbortController | null;
  owner: unknown;
}

export interface NavigationMenuRootContext<Value = any> {
  open: Accessor<boolean>;
  value: Accessor<Value | null>;
  setValue: (value: Value | null, eventDetails: RebaseUIChangeEventDetails<NavigationMenuRoot.ChangeEventReason>) => void;
  mounted: Accessor<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
  positionerElement: Accessor<HTMLElement | null>;
  setPositionerElement: (element: HTMLElement | null) => void;
  popupElement: Accessor<HTMLElement | null>;
  setPopupElement: (element: HTMLElement | null) => void;
  viewportElement: Accessor<HTMLElement | null>;
  setViewportElement: (element: HTMLElement | null) => void;
  viewportTargetElement: Accessor<HTMLElement | null>;
  setViewportTargetElement: (element: HTMLElement | null) => void;
  activationDirection: Accessor<"left" | "right" | "up" | "down" | null>;
  setActivationDirection: (direction: "left" | "right" | "up" | "down" | null) => void;
  /**
   * The active trigger. Stays set through the closing animation so the popup doesn't lose its anchor.
   */
  activeTrigger: Accessor<HTMLElement | null>;
  setActiveTrigger: (element: HTMLElement | null) => void;
  currentContent: Accessor<HTMLElement | null>;
  setCurrentContent: (element: HTMLElement | null) => void;
  nested: boolean;
  rootElement: Accessor<HTMLElement | null>;
  beforeInsideRef: { current: HTMLElement | null };
  afterInsideRef: { current: HTMLElement | null };
  beforeOutsideRef: { current: HTMLElement | null };
  afterOutsideRef: { current: HTMLElement | null };
  prevTriggerElementRef: { current: Element | null | undefined };
  popupAutoSizeResetRef: { current: NavigationMenuPopupAutoSizeResetState };
  delay: Accessor<number>;
  closeDelay: Accessor<number>;
  orientation: Accessor<"horizontal" | "vertical">;
  viewportInert: Accessor<boolean>;
  setViewportInert: (inert: boolean) => void;
}

export const NavigationMenuRootContext = createContext<NavigationMenuRootContext>();

export function useNavigationMenuRootContext(): NavigationMenuRootContext;
export function useNavigationMenuRootContext(optional: true): NavigationMenuRootContext | undefined;
export function useNavigationMenuRootContext(optional?: boolean) {
  const context = useContext(NavigationMenuRootContext);
  if (context === undefined && !optional) {
    throw new Error("Rebase UI: NavigationMenuRootContext is missing. Navigation Menu parts must be placed within <NavigationMenu.Root>.");
  }
  return context;
}

export const NavigationMenuTreeContext = createContext<string | undefined>();

export function useNavigationMenuTreeContext() {
  return useContext(NavigationMenuTreeContext);
}

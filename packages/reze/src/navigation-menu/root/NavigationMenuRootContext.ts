import { createContext, useContext } from "reze-js";

import type { RebaseUIChangeEventDetails } from "../../internals/event-details";
import type { TransitionStatus } from "../../internals/transition-status";
import type { NavigationMenuRoot } from "./NavigationMenuRoot";

type Getter<T> = () => T;

export interface NavigationMenuPopupAutoSizeResetState {
  abortController: AbortController | null;
  owner: unknown;
}

export interface NavigationMenuRootContext<Value = any> {
  open: Getter<boolean>;
  value: Getter<Value | null>;
  setValue: (value: Value | null, eventDetails: RebaseUIChangeEventDetails<NavigationMenuRoot.ChangeEventReason>) => void;
  mounted: Getter<boolean>;
  transitionStatus: Getter<TransitionStatus>;
  positionerElement: Getter<HTMLElement | null>;
  setPositionerElement: (element: HTMLElement | null) => void;
  popupElement: Getter<HTMLElement | null>;
  setPopupElement: (element: HTMLElement | null) => void;
  viewportElement: Getter<HTMLElement | null>;
  setViewportElement: (element: HTMLElement | null) => void;
  viewportTargetElement: Getter<HTMLElement | null>;
  setViewportTargetElement: (element: HTMLElement | null) => void;
  activationDirection: Getter<"left" | "right" | "up" | "down" | null>;
  setActivationDirection: (direction: "left" | "right" | "up" | "down" | null) => void;
  /**
   * The active trigger. Stays set through the closing animation so the popup doesn't lose its anchor.
   */
  activeTrigger: Getter<HTMLElement | null>;
  setActiveTrigger: (element: HTMLElement | null) => void;
  currentContent: Getter<HTMLElement | null>;
  setCurrentContent: (element: HTMLElement | null) => void;
  nested: boolean;
  rootElement: Getter<HTMLElement | null>;
  beforeInsideRef: { current: HTMLElement | null };
  afterInsideRef: { current: HTMLElement | null };
  beforeOutsideRef: { current: HTMLElement | null };
  afterOutsideRef: { current: HTMLElement | null };
  prevTriggerElementRef: { current: Element | null | undefined };
  popupAutoSizeResetRef: { current: NavigationMenuPopupAutoSizeResetState };
  delay: Getter<number>;
  closeDelay: Getter<number>;
  orientation: Getter<"horizontal" | "vertical">;
  viewportInert: Getter<boolean>;
  setViewportInert: (inert: boolean) => void;
}

export const NavigationMenuRootContext = createContext<NavigationMenuRootContext | undefined>(undefined);

export function useNavigationMenuRootContext(): NavigationMenuRootContext;
export function useNavigationMenuRootContext(optional: true): NavigationMenuRootContext | undefined;
export function useNavigationMenuRootContext(optional?: boolean) {
  const context = useContext(NavigationMenuRootContext);
  if (context === undefined && !optional) {
    throw new Error("Rebase UI: NavigationMenuRootContext is missing. Navigation Menu parts must be placed within <NavigationMenu.Root>.");
  }
  return context;
}

export const NavigationMenuTreeContext = createContext<string | undefined>(undefined);

export function useNavigationMenuTreeContext() {
  return useContext(NavigationMenuTreeContext);
}

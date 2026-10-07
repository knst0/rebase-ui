import { createEffect } from "solid-js";

import type { SafePolygonOptions } from "../safePolygon";
import type { FloatingRootStore } from "../tree/FloatingRootStore";
import type { ContextData } from "../types";

export { isInteractiveElement } from "../utils/element";

// Minimal `setTimeout` wrapper mirroring the upstream `Timeout` surface.
export class Timeout {
  private currentId: ReturnType<typeof setTimeout> | undefined;

  start(delay: number, fn: () => void) {
    this.clear();
    this.currentId = setTimeout(() => {
      this.currentId = undefined;
      fn();
    }, delay);
  }

  clear = () => {
    clearTimeout(this.currentId);
    this.currentId = undefined;
  };
}

// Mutable hover state shared by the reference and floating interactions of one
// root. Solid port of upstream `HoverInteraction` (mui/base-ui v1.8.0).
export class HoverInteraction {
  pointerType: string | undefined;
  interactedInside: boolean;
  handler: ((event: MouseEvent) => void) | undefined;
  blockMouseMove: boolean;
  performedPointerEventsMutation: boolean;
  pointerEventsScopeElement: HTMLElement | SVGSVGElement | null;
  pointerEventsReferenceElement: HTMLElement | SVGSVGElement | null;
  pointerEventsFloatingElement: HTMLElement | null;
  restTimeoutPending: boolean;
  openChangeTimeout: Timeout;
  restTimeout: Timeout;
  handleCloseOptions: SafePolygonOptions | undefined;

  constructor() {
    this.pointerType = undefined;
    this.interactedInside = false;
    this.handler = undefined;
    this.blockMouseMove = true;
    this.performedPointerEventsMutation = false;
    this.pointerEventsScopeElement = null;
    this.pointerEventsReferenceElement = null;
    this.pointerEventsFloatingElement = null;
    this.restTimeoutPending = false;
    this.openChangeTimeout = new Timeout();
    this.restTimeout = new Timeout();
    this.handleCloseOptions = undefined;
  }

  static create(): HoverInteraction {
    return new HoverInteraction();
  }

  dispose = () => {
    this.openChangeTimeout.clear();
    this.restTimeout.clear();
  };
}

type PointerEventsMutationState = Pick<
  HoverInteraction,
  "performedPointerEventsMutation" | "pointerEventsScopeElement" | "pointerEventsReferenceElement" | "pointerEventsFloatingElement"
>;

const pointerEventsMutationOwnerByScopeElement = new WeakMap<HTMLElement | SVGSVGElement, PointerEventsMutationState>();

export function clearSafePolygonPointerEventsMutation(instance: PointerEventsMutationState) {
  if (!instance.performedPointerEventsMutation) {
    return;
  }

  const scopeElement = instance.pointerEventsScopeElement;

  if (scopeElement && pointerEventsMutationOwnerByScopeElement.get(scopeElement) === instance) {
    instance.pointerEventsScopeElement?.style.removeProperty("pointer-events");
    instance.pointerEventsReferenceElement?.style.removeProperty("pointer-events");
    instance.pointerEventsFloatingElement?.style.removeProperty("pointer-events");
    pointerEventsMutationOwnerByScopeElement.delete(scopeElement);
  }

  instance.performedPointerEventsMutation = false;
  instance.pointerEventsScopeElement = null;
  instance.pointerEventsReferenceElement = null;
  instance.pointerEventsFloatingElement = null;
}

export function applySafePolygonPointerEventsMutation(
  instance: PointerEventsMutationState,
  options: {
    scopeElement: HTMLElement | SVGSVGElement;
    referenceElement: HTMLElement | SVGSVGElement;
    floatingElement: HTMLElement;
  },
) {
  const { scopeElement, referenceElement, floatingElement } = options;

  const existingOwner = pointerEventsMutationOwnerByScopeElement.get(scopeElement);
  if (existingOwner && existingOwner !== instance) {
    clearSafePolygonPointerEventsMutation(existingOwner);
  }

  clearSafePolygonPointerEventsMutation(instance);
  instance.performedPointerEventsMutation = true;
  instance.pointerEventsScopeElement = scopeElement;
  instance.pointerEventsReferenceElement = referenceElement;
  instance.pointerEventsFloatingElement = floatingElement;
  pointerEventsMutationOwnerByScopeElement.set(scopeElement, instance);

  scopeElement.style.pointerEvents = "none";
  referenceElement.style.pointerEvents = "auto";
  floatingElement.style.pointerEvents = "auto";
}

type HoverContextData = ContextData & {
  hoverInteractionState?: HoverInteraction | undefined;
};

const registeredDisposal = new WeakSet<HoverInteraction>();

// Returns the shared instance cached on the root `dataRef`, creating it on
// first use. Disposal (timeout clearing) is registered once per instance.
export function createHoverInteractionSharedState(store: FloatingRootStore): HoverInteraction {
  const data = store.context.dataRef.current as HoverContextData;
  data.hoverInteractionState ??= HoverInteraction.create();
  const instance = data.hoverInteractionState;

  if (!registeredDisposal.has(instance)) {
    registeredDisposal.add(instance);
    createEffect(
      () => undefined,
      () => () => {
        instance.dispose();
      },
    );
  }

  return instance;
}

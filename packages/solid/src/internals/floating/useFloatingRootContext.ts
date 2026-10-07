import { isElement } from "@floating-ui/utils/dom";
import { createEffect, createUniqueId } from "solid-js";

import type { RebaseUIChangeEventDetails } from "../event-details/createEventDetails";
import { accessBoolean, type ReactiveBoolean } from "../maybeAccessor";
import { FloatingRootStore, type FloatingRootState } from "./tree/FloatingRootStore";
import { useFloatingParentNodeId } from "./tree/FloatingTree";
import { PopupTriggerMap } from "./triggerMap";
import type { ReferenceType } from "./types";

export interface UseFloatingRootContextOptions {
  open?: ReactiveBoolean | undefined;
  onOpenChange?(open: boolean, eventDetails: RebaseUIChangeEventDetails<string>): void;
  elements?:
    | {
        reference?: ReferenceType | null | undefined;
        floating?: HTMLElement | null | undefined;
      }
    | undefined;
}

export function useFloatingRootContext(options: UseFloatingRootContextOptions): FloatingRootStore {
  const { elements = {} } = options;
  const handleOpenChange = (open: boolean, eventDetails: RebaseUIChangeEventDetails<string>): void => {
    options.onOpenChange?.(open, eventDetails);
  };

  const floatingId = createUniqueId();
  const nested = useFloatingParentNodeId() != null;

  if (process.env.NODE_ENV !== "production") {
    const optionDomReference = elements.reference;
    if (optionDomReference && !isElement(optionDomReference)) {
      console.error(
        "Cannot pass a virtual element to the `elements.reference` option,",
        "as it must be a real DOM element. Use `context.setPositionReference()`",
        "instead.",
      );
    }
  }

  let store: FloatingRootStore | undefined;
  const getStore = () => {
    store ??= new FloatingRootStore({
      open: accessBoolean(options.open),
      transitionStatus: undefined,
      onOpenChange: handleOpenChange,
      referenceElement: elements.reference ?? null,
      floatingElement: elements.floating ?? null,
      triggerElements: new PopupTriggerMap(),
      floatingId,
      syncOnly: false,
      nested,
    });
    return store;
  };

  createEffect(
    () => accessBoolean(options.open),
    (open) => {
      const current = getStore();

      const valuesToSync = { open, floatingId } as Pick<
        FloatingRootState,
        "open" | "floatingId" | "referenceElement" | "domReferenceElement" | "floatingElement"
      >;

      if (elements.reference !== undefined) {
        valuesToSync.referenceElement = elements.reference;
        valuesToSync.domReferenceElement = isElement(elements.reference) ? elements.reference : null;
      }

      if (elements.floating !== undefined) {
        valuesToSync.floatingElement = elements.floating;
      }

      current.update(valuesToSync);

      // Keep non-reactive context values fresh for interactions that call `store.setOpen`.
      current.context.onOpenChange = handleOpenChange;
      current.context.nested = nested;
    },
  );

  return getStore();
}

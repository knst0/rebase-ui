import { isElement } from "@floating-ui/utils/dom";
import type { Accessor } from "solid-js";
import { createEffect, untrack } from "solid-js";

import type { RebaseUIChangeEventDetails } from "../event-details/createEventDetails";
import { FloatingRootStore, type FloatingRootState } from "./tree/FloatingRootStore";
import type { TriggerElementsMap } from "./types";

/**
 * Narrowed to the store members this hook uses so consumers do not need to provide
 * unrelated store capabilities. Satisfied by the popup stores once ported.
 */
export interface SyncedPopupStore {
  useState(key: "open"): Accessor<boolean>;
  useState(key: "activeTriggerElement"): Accessor<Element | null>;
  useState(key: "popupElement" | "positionerElement"): Accessor<HTMLElement | null>;
  useSyncedValue(key: "floatingId", getValue: () => string | undefined): void;
  context: { triggerElements: TriggerElementsMap };
}

export interface UseSyncedFloatingRootContextOptions<OpenChangeEventDetails extends RebaseUIChangeEventDetails<string>> {
  popupStore: SyncedPopupStore;
  /**
   * Whether the Popup element is passed to Floating UI as the floating element instead of the default Positioner.
   */
  treatPopupAsFloatingElement?: boolean | undefined;
  floatingRootContext?: FloatingRootStore | undefined;
  floatingId: string | undefined;
  nested: boolean;
  onOpenChange(open: boolean, eventDetails: OpenChangeEventDetails): void;
}

/**
 * Keeps a FloatingRootStore in sync with the provided popup store.
 * Uses the provided FloatingRootStore when one exists, otherwise creates one once and updates it.
 */
export function useSyncedFloatingRootContext<OpenChangeEventDetails extends RebaseUIChangeEventDetails<string>>(
  options: UseSyncedFloatingRootContextOptions<OpenChangeEventDetails>,
): FloatingRootStore {
  const { popupStore, treatPopupAsFloatingElement = false, floatingRootContext: floatingRootContextProp, floatingId, nested } = options;

  const open = popupStore.useState("open");
  const referenceElement = popupStore.useState("activeTriggerElement");
  const floatingElement = popupStore.useState(treatPopupAsFloatingElement ? "popupElement" : "positionerElement");
  const triggerElements = popupStore.context.triggerElements;

  const handleOpenChange = (open: boolean, eventDetails: RebaseUIChangeEventDetails<string>): void => {
    options.onOpenChange(open, eventDetails as OpenChangeEventDetails);
  };

  let internalStore: FloatingRootStore | null = null;
  if (floatingRootContextProp === undefined && internalStore === null) {
    internalStore = new FloatingRootStore({
      open: open(),
      transitionStatus: undefined,
      referenceElement: referenceElement(),
      floatingElement: floatingElement(),
      triggerElements,
      onOpenChange: handleOpenChange,
      floatingId,
      syncOnly: true,
      nested,
    });
  }

  const store = floatingRootContextProp ?? internalStore!;

  popupStore.useSyncedValue("floatingId", () => floatingId);

  createEffect(
    () => ({
      open: open(),
      referenceElement: referenceElement(),
      floatingElement: floatingElement(),
    }),
    (values) => {
      const valuesToSync = {
        open: values.open,
        floatingId,
        referenceElement: values.referenceElement,
        floatingElement: values.floatingElement,
      } as Pick<
        FloatingRootState,
        "open" | "floatingId" | "referenceElement" | "floatingElement" | "domReferenceElement" | "positionReference"
      >;

      if (isElement(values.referenceElement)) {
        valuesToSync.domReferenceElement = values.referenceElement as Element;
      }

      // One-shot comparison: the values only steer this sync write and must not subscribe.
      const syncState = untrack(() => ({ ...store.state }));
      if (syncState.positionReference === syncState.referenceElement) {
        valuesToSync.positionReference = values.referenceElement;
      }

      store.update(valuesToSync);

      // Keep non-reactive context values fresh for interactions that call `store.setOpen`.
      store.context.onOpenChange = handleOpenChange;
      store.context.nested = nested;
    },
  );

  return store;
}

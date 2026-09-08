import { type Accessor, createEffect, createUniqueId, getOwner, onCleanup } from "solid-js";

import { NOOP } from "#utils/empty";

import type { RegistrationSource } from "../types";
import { useLabelableContext } from "./LabelableContext";

export interface CreateLabelableIdParameters {
  id?: Accessor<string | undefined> | undefined;
  implicit?: Accessor<boolean | undefined> | undefined;
  controlElement?: Accessor<HTMLElement | null> | undefined;
}

export function createLabelableId(params: CreateLabelableIdParameters = {}): Accessor<string> {
  const { controlId, registerControlId, resetControlId } = useLabelableContext();

  const generatedId = createUniqueId();
  const id = () => params.id?.();
  const implicit = () => params.implicit?.() ?? false;
  const defaultId = () => id() ?? generatedId;

  const controlSource: RegistrationSource = getOwner() ?? {};
  let hasRegistered = false;
  // Deliberately not seeded from `id`: the seed would stick around after the `id` prop is
  // removed, leaving the control on a stale id forever.
  let hadExplicitId = false;

  function unregisterControlId() {
    if (!hasRegistered || registerControlId === NOOP) {
      return;
    }

    hasRegistered = false;
    registerControlId(controlSource, undefined);
  }

  createEffect(
    () => ({
      currentId: id(),
      isImplicit: implicit(),
      element: params.controlElement?.() ?? null,
      contextControlId: implicit() ? controlId() : undefined,
      fallbackId: defaultId(),
    }),
    ({ currentId, isImplicit, element, contextControlId, fallbackId }) => {
      if (registerControlId === NOOP) {
        return;
      }

      let nextId: string | null | undefined;

      if (isImplicit) {
        if (element != null && element.closest("label") != null) {
          nextId = currentId ?? null;
        } else {
          nextId = contextControlId ?? fallbackId;
        }
      } else if (currentId != null) {
        hadExplicitId = true;
        nextId = currentId;
      } else if (hadExplicitId) {
        nextId = fallbackId;
      } else {
        // An id-less replacement must claim the provider's fallback so a previously registered
        // explicit id is not retained after its control unmounts.
        unregisterControlId();
        resetControlId();
        return;
      }

      if (nextId === undefined) {
        unregisterControlId();
        return;
      }

      hasRegistered = true;
      registerControlId(controlSource, nextId);
    },
  );

  onCleanup(unregisterControlId);

  return () => controlId() ?? defaultId();
}

import { type Accessor, createEffect, createUniqueId, getOwner, onCleanup } from "solid-js";

import { NOOP } from "#utils/empty";

import { useLabelableContext } from "./LabelableContext";

export interface CreateLabelableIdParameters {
  /**
   * The control's own `id`. `null` claims the scope while telling the label to omit `htmlFor`,
   * for a control that takes its name from `aria-labelledby` instead.
   */
  id?: Accessor<string | null | undefined> | undefined;
  implicit?: Accessor<boolean | undefined> | undefined;
  controlElement?: Accessor<HTMLElement | null> | undefined;
  /**
   * Whether the control owns the scope's control id. When `false` it still resolves an `id` to
   * render but never registers it, leaving the association to whoever does own the scope.
   * @default true
   */
  enabled?: Accessor<boolean | undefined> | undefined;
}

export function createLabelableId(params: CreateLabelableIdParameters = {}): Accessor<string> {
  const { controlId, registerControlId, resetControlId } = useLabelableContext();

  const generatedId = createUniqueId();
  const id = () => params.id?.();
  const implicit = () => params.implicit?.() ?? false;
  const enabled = () => params.enabled?.() ?? true;
  const defaultId = () => id() ?? generatedId;
  const resolvedId = () => defaultId() ?? generatedId;

  const controlSource: object = getOwner() ?? {};
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
      isEnabled: enabled(),
      element: params.controlElement?.() ?? null,
      contextControlId: implicit() ? controlId() : undefined,
      fallbackId: resolvedId(),
    }),
    ({ currentId, isImplicit, isEnabled, element, contextControlId, fallbackId }) => {
      if (registerControlId === NOOP) {
        return;
      }

      if (!isEnabled) {
        unregisterControlId();
        return;
      }

      let nextId: string | null | undefined;

      if (currentId === null) {
        // The control takes its name from `aria-labelledby`; claim the scope so no sibling
        // control is picked as the label's target, but leave `htmlFor` unset.
        nextId = null;
      } else if (isImplicit) {
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

  return () => (enabled() ? (controlId() ?? resolvedId()) : resolvedId());
}

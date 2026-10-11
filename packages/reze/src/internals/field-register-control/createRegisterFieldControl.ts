import { effect, getOwner, onCleanup, untrack } from "reze-js";

import { useFieldRootContext } from "../field-root-context";
import type { FieldControlRegistration } from "./createFieldControlRegistration";

export interface CreateRegisterFieldControlParameters {
  controlElement: () => HTMLElement | null;
  id: () => string | undefined;
  value: () => unknown;
  getFormValue?: (() => unknown) | undefined;
  enabled?: (() => boolean | undefined) | undefined;
  name?: (() => string | undefined) | undefined;
}

export function createRegisterFieldControl(params: CreateRegisterFieldControlParameters): void {
  const { registerFieldControl } = useFieldRootContext();
  const source: object = getOwner() ?? {};

  effect(() => {
    const id = params.id();
    const value = params.value();
    const enabled = params.enabled?.() ?? true;
    const name = params.name?.();

    // Actions never subscribe: registration only writes, so the effect tracks
    // just the id, value, enabled, and name inputs above.
    untrack(() => {
      if (!enabled) {
        registerFieldControl(source, undefined);
        return;
      }

      const registration: FieldControlRegistration = {
        get controlElement() {
          return params.controlElement();
        },
        getValue: params.getFormValue,
        id,
        name,
        value,
      };

      registerFieldControl(source, registration);
    });
  });

  onCleanup(() => {
    registerFieldControl(source, undefined);
  });
}

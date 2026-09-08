import { type Accessor, createEffect, onCleanup } from "solid-js";

import { useFieldRootContext } from "../field-root-context";
import type { FieldControlRegistration } from "./createFieldControlRegistration";

export interface CreateRegisterFieldControlParameters {
  controlElement: Accessor<HTMLElement | null>;
  id: Accessor<string | undefined>;
  value: Accessor<unknown>;
  getFormValue?: Accessor<unknown> | undefined;
  enabled?: Accessor<boolean | undefined> | undefined;
  name?: Accessor<string | undefined> | undefined;
}

export function createRegisterFieldControl(params: CreateRegisterFieldControlParameters): void {
  const { registerFieldControl } = useFieldRootContext();
  const source = Symbol();

  createEffect(
    () => ({ id: params.id(), value: params.value(), enabled: params.enabled?.() ?? true, name: params.name?.() }),
    ({ id, value, enabled, name }) => {
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
    },
  );

  onCleanup(() => {
    registerFieldControl(source, undefined);
  });
}

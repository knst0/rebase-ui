import type { JSX } from "@solidjs/web";
import { createMemo } from "solid-js";

import { useFieldRootContext } from "../../internals/field-root-context";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { FieldValidityData } from "../root/FieldRoot";
import { getCombinedFieldValidityData } from "../utils/getCombinedFieldValidityData";

/**
 * Used to display a custom message based on the field's validity.
 * Does not render an HTML element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldValidity(props: FieldValidity.Props) {
  const { validityData, invalid } = useFieldRootContext(false);

  const combinedFieldValidityData = createMemo(() => getCombinedFieldValidityData(validityData, invalid()));
  const isInvalid = createMemo(() => combinedFieldValidityData().state.valid === false);
  const { transitionStatus } = createTransitionStatus(isInvalid);

  const fieldValidityState = createMemo<FieldValidityState>(() => {
    const combined = combinedFieldValidityData();
    return {
      ...combined,
      validity: combined.state,
      transitionStatus: transitionStatus(),
    };
  });

  return <>{props.children(fieldValidityState())}</>;
}

export interface FieldValidityState extends Omit<FieldValidityData, "state"> {
  /**
   * The validity state.
   */
  validity: FieldValidityData["state"];
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldValidityProps {
  /**
   * A function that accepts the field validity state as an argument.
   *
   * ```jsx
   * <Field.Validity>
   *   {(validity) => {
   *     return <div>...</div>
   *   }}
   * </Field.Validity>
   * ```
   */
  children: (state: FieldValidityState) => JSX.Element;
}

export namespace FieldValidity {
  export type State = FieldValidityState;
  export type Props = FieldValidityProps;
}

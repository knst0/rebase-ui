import { getOwner, runWithOwner, store, type JSX } from "reze-js";

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
export function FieldValidity(props: FieldValidity.Props): JSX.Element {
  const { validityData, invalid } = useFieldRootContext(false);

  const transition = store({ mounted: false, transitionStatus: undefined as TransitionStatus });

  function setMounted(next: boolean): void {
    if (transition.mounted !== next) {
      transition.mounted = next;
    }
  }

  function setTransitionStatus(next: TransitionStatus): void {
    if (transition.transitionStatus !== next) {
      transition.transitionStatus = next;
    }
  }

  function isInvalid(): boolean {
    return getCombinedFieldValidityData(validityData, invalid()).state.valid === false;
  }

  createTransitionStatus({
    open: isInvalid,
    mounted: () => transition.mounted,
    transitionStatus: () => transition.transitionStatus,
    setMounted,
    setTransitionStatus,
  });

  // Read once: invoking the children getter per binding run would recreate child components.
  const render = props.children;
  // The thunk runs later under the renderer's owner, so re-enter this owner
  // to keep the field context (and disposal) visible to the rendered parts.
  const owner = getOwner();

  return () => {
    // Subscribe the binding: the render below runs untracked under the owner.
    const combined = getCombinedFieldValidityData(validityData, invalid());
    const snapshot: FieldValidityState = {
      ...combined,
      validity: combined.state,
      transitionStatus: transition.transitionStatus,
    };

    return runWithOwner(owner, () => render(snapshot));
  };
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

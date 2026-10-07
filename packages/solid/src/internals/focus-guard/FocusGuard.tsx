import { onCleanup } from "solid-js";

import { visuallyHidden } from "../utils/visuallyHidden";

export interface FocusGuardProps {
  guardRef?: { current: HTMLSpanElement | null } | undefined;
  onFocus?: ((event: FocusEvent) => void) | undefined;
}

/**
 * Invisible focus guard placed around popup triggers.
 * Solid port of upstream `FocusGuard` (mui/base-ui `utils/FocusGuard`).
 * @internal
 */
export function FocusGuard(props: FocusGuardProps) {
  const guardRef = props.guardRef;

  if (guardRef) {
    onCleanup(() => {
      guardRef.current = null;
    });
  }

  return (
    <span
      ref={(element: HTMLSpanElement) => {
        if (guardRef) {
          guardRef.current = element;
        }
      }}
      tabindex={0}
      style={visuallyHidden}
      aria-hidden="true"
      data-base-ui-focus-guard=""
      onFocus={props.onFocus}
    />
  );
}

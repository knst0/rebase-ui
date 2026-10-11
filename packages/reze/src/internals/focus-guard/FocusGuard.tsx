import { onCleanup, type JSX } from "reze-js";

import { visuallyHidden } from "../utils/visuallyHidden";

export interface FocusGuardProps {
  guardRef?: { current: HTMLElement | null } | undefined;
  onFocus?: ((event: FocusEvent) => void) | undefined;
}

/**
 * Invisible focus guard placed around popup triggers.
 * Reze port of upstream `FocusGuard` (mui/base-ui `utils/FocusGuard`).
 * @internal
 */
export function FocusGuard(props: FocusGuardProps): JSX.Element {
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

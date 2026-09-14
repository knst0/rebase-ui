import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";

export interface NumberFieldScrubAreaContext {
  isScrubbing: Accessor<boolean>;
  isTouchInput: Accessor<boolean>;
  isPointerLockDenied: Accessor<boolean>;
  scrubAreaCursorElement: Accessor<HTMLSpanElement | null>;
  setScrubAreaCursorElement: (element: HTMLSpanElement | null) => void;
}

export const NumberFieldScrubAreaContext = createContext<NumberFieldScrubAreaContext>();

export function useNumberFieldScrubAreaContext() {
  const context = useContext(NumberFieldScrubAreaContext);
  if (context === undefined) {
    throw new Error(
      "Rebase UI: NumberFieldScrubAreaContext is missing. NumberFieldScrubArea parts must be placed within <NumberField.ScrubArea>.",
    );
  }
  return context;
}

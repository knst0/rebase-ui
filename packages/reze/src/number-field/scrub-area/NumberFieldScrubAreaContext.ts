import { createContext, useContext } from "reze-js";

export interface NumberFieldScrubAreaContext {
  isScrubbing: () => boolean;
  isTouchInput: () => boolean;
  isPointerLockDenied: () => boolean;
  scrubAreaCursorElement: () => HTMLSpanElement | null;
  setScrubAreaCursorElement: (element: HTMLSpanElement | null) => void;
}

export const NumberFieldScrubAreaContext = createContext<NumberFieldScrubAreaContext | undefined>(undefined);

export function useNumberFieldScrubAreaContext() {
  const context = useContext(NumberFieldScrubAreaContext);
  if (context === undefined) {
    throw new Error(
      "Rebase UI: NumberFieldScrubAreaContext is missing. NumberFieldScrubArea parts must be placed within <NumberField.ScrubArea>.",
    );
  }
  return context;
}

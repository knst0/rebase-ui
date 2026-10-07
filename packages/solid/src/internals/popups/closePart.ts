import { createSignal, onSettled } from "solid-js";

import { createContext, useContext } from "../context";

export interface ClosePartContextValue {
  register: () => () => void;
}

export const ClosePartContext = createContext<ClosePartContextValue>();

export interface ClosePartCount {
  context: ClosePartContextValue;
  hasClosePart: () => boolean;
}

/**
 * Counts mounted close parts (`Popover.Close`, ...) inside a popup.
 * Solid port of upstream `useClosePartCount` (mui/base-ui `utils/closePart`).
 */
export function createClosePartCount(): ClosePartCount {
  const [closePartCount, setClosePartCount] = createSignal(0, { ownedWrite: true });

  const register = () => {
    setClosePartCount((count) => count + 1);

    return () => {
      setClosePartCount((count) => Math.max(0, count - 1));
    };
  };

  return {
    context: { register },
    hasClosePart: () => closePartCount() > 0,
  };
}

/**
 * Registers the enclosing close part with the nearest popup's close-part count.
 * Solid port of upstream `useClosePartRegistration`.
 */
export function useClosePartRegistration(): void {
  const context = useContext(ClosePartContext);

  if (context) {
    // Registration writes root-owned state, so it happens outside the
    // component's owned scope once rendering has settled. The returned
    // unregister function runs as cleanup.
    onSettled(() => context.register());
  }
}

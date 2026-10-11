import { createContext, effect, onCleanup, store, untrack, useContext } from "reze-js";

export interface ClosePartContextValue {
  register: () => () => void;
}

export const ClosePartContext = createContext<ClosePartContextValue | undefined>(undefined);

export interface ClosePartCount {
  context: ClosePartContextValue;
  hasClosePart: () => boolean;
}

/**
 * Counts mounted close parts (`Popover.Close`, ...) inside a popup.
 * Solid port of upstream `useClosePartCount` (mui/base-ui `utils/closePart`).
 */
export function createClosePartCount(): ClosePartCount {
  const state = store({ closePartCount: 0 });

  const register = () => {
    // Actions never subscribe: without untrack, the read half of += inside an
    // effect would subscribe the effect to the counter it writes (self-loop).
    untrack(() => {
      state.closePartCount += 1;
    });

    return () => {
      untrack(() => {
        state.closePartCount = Math.max(0, state.closePartCount - 1);
      });
    };
  };

  return {
    context: { register },
    hasClosePart: () => state.closePartCount > 0,
  };
}

/**
 * Registers the enclosing close part with the nearest popup's close-part count.
 * Solid port of upstream `useClosePartRegistration`.
 */
export function useClosePartRegistration(): void {
  const context = useContext(ClosePartContext);

  if (context) {
    // Registration writes root-owned state, so it happens in an effect (outside the
    // component's synchronous render). The returned unregister function runs as cleanup.
    effect(() => {
      const unregister = untrack(() => context.register());
      onCleanup(unregister);
    });
  }
}

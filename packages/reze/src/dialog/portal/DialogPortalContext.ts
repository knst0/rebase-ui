import { createContext, useContext } from "reze-js";

export const DialogPortalContext = createContext<boolean | undefined>(undefined);

export function useDialogPortalContext(): boolean {
  const value = useContext(DialogPortalContext);

  if (value === undefined) {
    throw new Error("Rebase UI: <Dialog.Portal> is missing.");
  }

  return value;
}

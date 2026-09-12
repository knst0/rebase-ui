import { createContext, useContext } from "../../internals/context";

export const DialogPortalContext = createContext<boolean>();

export function useDialogPortalContext(): boolean {
  const value = useContext(DialogPortalContext);

  if (value === undefined) {
    throw new Error("Rebase UI: <Dialog.Portal> is missing.");
  }

  return value;
}

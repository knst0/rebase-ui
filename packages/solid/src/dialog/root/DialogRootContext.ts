import { createContext, useContext } from "../../internals/context";
import type { CreateDialogRootReturnValue } from "./createDialogRoot";

export type DialogRootContext = CreateDialogRootReturnValue;

export const DialogRootContext = createContext<DialogRootContext>();

export function useDialogRootContext(optional?: false): DialogRootContext;
export function useDialogRootContext(optional: true): DialogRootContext | undefined;
export function useDialogRootContext(optional?: boolean): DialogRootContext | undefined {
  const context = useContext(DialogRootContext);

  if (!optional && context === undefined) {
    throw new Error("Rebase UI: DialogRootContext is missing. Dialog parts must be placed within <Dialog.Root>.");
  }

  return context;
}

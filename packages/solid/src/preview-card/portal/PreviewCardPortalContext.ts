import { createContext, useContext } from "../../internals/context";

export const PreviewCardPortalContext = createContext<boolean>();

export function usePreviewCardPortalContext(): boolean {
  const value = useContext(PreviewCardPortalContext);
  if (value === undefined) {
    throw new Error("Rebase UI: <PreviewCard.Portal> is missing.");
  }
  return value;
}

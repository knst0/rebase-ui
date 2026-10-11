import { createContext, useContext } from "reze-js";

export const PreviewCardPortalContext = createContext<boolean | undefined>(undefined);

export function usePreviewCardPortalContext(): boolean {
  const value = useContext(PreviewCardPortalContext);
  if (value === undefined) {
    throw new Error("Rebase UI: <PreviewCard.Portal> is missing.");
  }
  return value;
}

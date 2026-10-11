import { createContext, useContext } from "reze-js";

import type { CreateAnchorPositioningReturnValue } from "../../internals/anchor-positioning/createAnchorPositioning";

export type PreviewCardPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  "side" | "align" | "arrowRef" | "arrowUncentered" | "arrowStyles"
>;

export const PreviewCardPositionerContext = createContext<PreviewCardPositionerContext | undefined>(undefined);

export function usePreviewCardPositionerContext(): PreviewCardPositionerContext {
  const context = useContext(PreviewCardPositionerContext);
  if (context === undefined) {
    throw new Error(
      "Rebase UI: PreviewCardPositionerContext is missing. PreviewCardPositioner parts must be placed within <PreviewCard.Positioner>.",
    );
  }
  return context;
}

import { createContext, useContext } from "../../internals/context";
import type { PreviewCardStore } from "../store/PreviewCardStore";

export type PreviewCardRootContext<Payload = unknown> = PreviewCardStore<Payload>;

export const PreviewCardRootContext = createContext<PreviewCardRootContext<any>>();

export function usePreviewCardRootContext(optional?: false): PreviewCardRootContext;
export function usePreviewCardRootContext(optional: true): PreviewCardRootContext | undefined;
export function usePreviewCardRootContext(optional?: boolean): PreviewCardRootContext | undefined {
  const context = useContext(PreviewCardRootContext);

  if (context === undefined && !optional) {
    throw new Error("Rebase UI: PreviewCardRootContext is missing. PreviewCard parts must be placed within <PreviewCard.Root>.");
  }

  return context;
}

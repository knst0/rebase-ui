import { createContext, useContext } from "reze-js";

import type { ImageLoadingStatus } from "./AvatarRoot";

export interface AvatarRootContext {
  imageLoadingStatus: () => ImageLoadingStatus;
  setImageLoadingStatus: (next: ImageLoadingStatus | ((prev: ImageLoadingStatus) => ImageLoadingStatus)) => void;
}

export const AvatarRootContext = createContext<AvatarRootContext | undefined>(undefined);

export function useAvatarRootContext(optional?: false): AvatarRootContext;
export function useAvatarRootContext(optional: true): AvatarRootContext | undefined;
export function useAvatarRootContext(optional?: boolean): AvatarRootContext | undefined {
  const context = useContext(AvatarRootContext);

  if (!optional && context === undefined) {
    throw new Error("Rebase UI: AvatarRootContext is missing. Avatar parts must be placed within <Avatar.Root>.");
  }

  return context;
}

import type { Accessor, Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { ImageLoadingStatus } from "./AvatarRoot";

export interface AvatarRootContext {
  imageLoadingStatus: Accessor<ImageLoadingStatus>;
  setImageLoadingStatus: Setter<ImageLoadingStatus>;
}

export const AvatarRootContext = createContext<AvatarRootContext>();

export function useAvatarRootContext(): AvatarRootContext {
  const context = useContext(AvatarRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: AvatarRootContext is missing. Avatar parts must be placed within <Avatar.Root>.");
  }

  return context;
}

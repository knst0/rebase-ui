import { createContext, useContext } from "reze-js";

import type { PopoverStore } from "../store/PopoverStore";

export type PopoverRootContext<Payload = unknown> = PopoverStore<Payload>;

export const PopoverRootContext = createContext<PopoverRootContext<any> | undefined>(undefined);

export function usePopoverRootContext(optional?: false): PopoverRootContext;
export function usePopoverRootContext(optional: true): PopoverRootContext | undefined;
export function usePopoverRootContext(optional?: boolean): PopoverRootContext | undefined {
  const context = useContext(PopoverRootContext);

  if (context === undefined && !optional) {
    throw new Error("Rebase UI: PopoverRootContext is missing. Popover parts must be placed within <Popover.Root>.");
  }

  return context;
}

import type { RebaseUIEvent } from "../types";

type MutableRebaseUIEvent<T extends Event> = T & {
  preventRebaseUIHandler: () => void;
  rebaseUIHandlerPrevented?: boolean;
};

export function makeEventPreventable<T extends Event>(event: RebaseUIEvent<T>): RebaseUIEvent<T> {
  event.preventRebaseUIHandler = () => {
    (event as MutableRebaseUIEvent<T>).rebaseUIHandlerPrevented = true;
  };

  return event;
}

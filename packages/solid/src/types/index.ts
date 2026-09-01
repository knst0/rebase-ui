export type { RebaseUIChangeEventDetails, RebaseUIGenericEventDetails } from "../internals/event-details/createEventDetails";

export type RebaseUIEvent<E extends Event = Event> = E & {
  preventRebaseUIHandler: () => void;
  readonly rebaseUIHandlerPrevented?: boolean;
};

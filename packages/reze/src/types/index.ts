export type RebaseUIEvent<E extends Event = Event> = E & {
  preventRebaseUIHandler: () => void;
  readonly rebaseUIHandlerPrevented?: boolean;
};

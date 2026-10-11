import * as REASONS from "./reason.parts";

export { REASONS };
export type EventReasons = typeof REASONS;
export type EventReason = EventReasons[keyof EventReasons];

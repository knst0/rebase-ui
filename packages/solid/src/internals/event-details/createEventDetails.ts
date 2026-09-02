import { REASONS } from "./reasons";

interface ReasonToEventMap {
  [REASONS.none]: Event;

  [REASONS.triggerPress]: MouseEvent | PointerEvent | TouchEvent | KeyboardEvent;
  [REASONS.triggerHover]: MouseEvent;
  [REASONS.triggerFocus]: FocusEvent;

  [REASONS.outsidePress]: MouseEvent | PointerEvent | TouchEvent;
  [REASONS.itemPress]: MouseEvent | KeyboardEvent | PointerEvent;
  [REASONS.closePress]: MouseEvent | KeyboardEvent | PointerEvent;
  [REASONS.linkPress]: MouseEvent | PointerEvent;
  [REASONS.clearPress]: PointerEvent | MouseEvent | KeyboardEvent;
  [REASONS.chipRemovePress]: PointerEvent | MouseEvent | KeyboardEvent;
  [REASONS.trackPress]: PointerEvent | MouseEvent | TouchEvent;
  [REASONS.incrementPress]: PointerEvent | MouseEvent | TouchEvent;
  [REASONS.decrementPress]: PointerEvent | MouseEvent | TouchEvent;

  [REASONS.inputChange]: InputEvent | Event;
  [REASONS.inputClear]: InputEvent | FocusEvent | Event;
  [REASONS.inputBlur]: FocusEvent;
  [REASONS.inputPaste]: ClipboardEvent;
  [REASONS.inputPress]: MouseEvent | PointerEvent | TouchEvent | KeyboardEvent;

  [REASONS.focusOut]: FocusEvent | KeyboardEvent;
  [REASONS.escapeKey]: KeyboardEvent;
  [REASONS.closeWatcher]: Event;
  [REASONS.listNavigation]: KeyboardEvent;
  [REASONS.keyboard]: KeyboardEvent;

  [REASONS.pointer]: PointerEvent;
  [REASONS.drag]: PointerEvent | TouchEvent;
  [REASONS.swipe]: PointerEvent | TouchEvent;
  [REASONS.wheel]: WheelEvent;
  [REASONS.scrub]: PointerEvent;

  [REASONS.cancelOpen]: MouseEvent;
  [REASONS.siblingOpen]: Event;
  [REASONS.disabled]: Event;
  [REASONS.missing]: Event;
  [REASONS.initial]: Event;
  [REASONS.imperativeAction]: Event;

  [REASONS.windowResize]: UIEvent;
}

/**
 * Maps a change `reason` string to the corresponding native event type.
 */
export type ReasonToEvent<Reason extends string> = Reason extends keyof ReasonToEventMap ? ReasonToEventMap[Reason] : Event;

type RebaseUIChangeEventDetail<Reason extends string, CustomProperties extends object> = {
  /**
   * The reason for the event.
   */
  reason: Reason;
  /**
   * The native event associated with the custom event.
   */
  event: ReasonToEvent<Reason>;
  /**
   * Cancels Rebase UI from handling the event.
   */
  cancel: () => void;
  /**
   * Allows the event to propagate in cases where Rebase UI will stop the propagation.
   */
  allowPropagation: () => void;
  /**
   * Indicates whether the event has been canceled.
   */
  isCanceled: boolean;
  /**
   * Indicates whether the event is allowed to propagate.
   */
  isPropagationAllowed: boolean;
  /**
   * The element that triggered the event, if applicable.
   */
  trigger: Element | undefined;
} & CustomProperties;

/**
 * Details of custom change events emitted by Rebase UI components.
 */
export type RebaseUIChangeEventDetails<Reason extends string, CustomProperties extends object = {}> = Reason extends string
  ? RebaseUIChangeEventDetail<Reason, CustomProperties> & {}
  : never;

/**
 * Details of custom generic events emitted by Rebase UI components.
 */
type RebaseUIGenericEventDetail<Reason extends string, CustomProperties extends object> = {
  /**
   * The reason for the event.
   */
  reason: Reason;
  /**
   * The native event associated with the custom event.
   */
  event: ReasonToEvent<Reason>;
} & CustomProperties;

export type RebaseUIGenericEventDetails<Reason extends string, CustomProperties extends object = {}> = Reason extends string
  ? RebaseUIGenericEventDetail<Reason, CustomProperties> & {}
  : never;

const PLACEHOLDER_EVENT_TYPE = "rebase-ui";

/**
 * Event details are allocated on every emitted event, so they are classes rather
 * than object literals: `cancel` and `allowPropagation` live on the prototype
 * instead of being a fresh closure per instance, and the flags they set are
 * plain fields instead of getters over captured variables.
 *
 * The methods read `this`, so they must be called as `details.cancel()` rather
 * than pulled off the object first.
 */
class ChangeEventDetails<Reason extends string> {
  isCanceled = false;
  isPropagationAllowed = false;

  constructor(
    readonly reason: Reason,
    readonly event: ReasonToEvent<Reason>,
    readonly trigger: Element | undefined,
  ) {}

  cancel(): void {
    this.isCanceled = true;
  }

  allowPropagation(): void {
    this.isPropagationAllowed = true;
  }
}

class GenericEventDetails<Reason extends string> {
  constructor(
    readonly reason: Reason,
    readonly event: ReasonToEvent<Reason>,
  ) {}
}

/**
 * Creates a Rebase UI event details object with the given reason and utilities
 * for preventing Rebase UI's internal event handling.
 */
export function createChangeEventDetails<Reason extends string, CustomProperties extends object = {}>(
  reason: Reason,
  event?: ReasonToEvent<Reason>,
  trigger?: Element,
  customProperties?: CustomProperties,
): RebaseUIChangeEventDetails<Reason, CustomProperties> {
  const details = new ChangeEventDetails(reason, (event ?? new Event(PLACEHOLDER_EVENT_TYPE)) as ReasonToEvent<Reason>, trigger);

  if (customProperties !== undefined) {
    Object.assign(details, customProperties);
  }

  return details as unknown as RebaseUIChangeEventDetails<Reason, CustomProperties>;
}

export function createGenericEventDetails<Reason extends keyof ReasonToEventMap, CustomProperties extends object = {}>(
  reason: Reason,
  event?: ReasonToEvent<Reason>,
  customProperties?: CustomProperties,
): RebaseUIGenericEventDetails<Reason, CustomProperties> {
  const details = new GenericEventDetails(reason, (event ?? new Event(PLACEHOLDER_EVENT_TYPE)) as ReasonToEvent<Reason>);

  if (customProperties !== undefined) {
    Object.assign(details, customProperties);
  }

  return details as unknown as RebaseUIGenericEventDetails<Reason, CustomProperties>;
}

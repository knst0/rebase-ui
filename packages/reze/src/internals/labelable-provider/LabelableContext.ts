import { createContext, useContext } from "reze-js";

import type { RegisteredLabelIdSetter } from "./createRegisteredLabelId";

export type MessageIdsSetter = (next: string[] | ((prev: string[]) => string[])) => void;

export interface LabelableContext {
  /**
   * The `id` of the labelable element.
   * When `null` the label omits `htmlFor`, either because the association is implicit or
   * because the control takes its name from `aria-labelledby`.
   */
  controlId: () => string | null | undefined;
  registerControlId: (source: object, id: string | null | undefined) => void;
  resetControlId: () => void;
  /**
   * The `id` of the label.
   */
  labelId: () => string | undefined;
  setLabelId: RegisteredLabelIdSetter;
  /**
   * An array of `id`s of elements that provide an accessible description.
   */
  messageIds: () => string[];
  setMessageIds: MessageIdsSetter;
  getDescriptionProps: (externalProps: Record<string, any>) => Record<string, any>;
}

function noop() {}

const NOOP_SETTER = noop as (...args: never[]) => void;

const EMPTY_ARRAY: string[] = [];

export const LabelableContext = createContext<LabelableContext>({
  controlId: () => undefined,
  registerControlId: NOOP_SETTER as LabelableContext["registerControlId"],
  resetControlId: noop,
  labelId: () => undefined,
  setLabelId: NOOP_SETTER as RegisteredLabelIdSetter,
  messageIds: () => EMPTY_ARRAY,
  setMessageIds: NOOP_SETTER as MessageIdsSetter,
  getDescriptionProps: (externalProps: Record<string, any>) => externalProps,
});

export function useLabelableContext(): LabelableContext {
  return useContext(LabelableContext);
}

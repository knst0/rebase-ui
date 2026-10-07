import { type Accessor, createContext, type Setter, useContext } from "solid-js";

import { EMPTY_ARRAY, NOOP, NOOP_SETTER } from "#utils/empty";

export interface LabelableContext {
  /**
   * The `id` of the labelable element.
   * When `null` the label omits `htmlFor`, either because the association is implicit or
   * because the control takes its name from `aria-labelledby`.
   */
  controlId: Accessor<string | null | undefined>;
  registerControlId: (source: object, id: string | null | undefined) => void;
  resetControlId: () => void;
  /**
   * The `id` of the label.
   */
  labelId: Accessor<string | undefined>;
  setLabelId: Setter<string | undefined>;
  /**
   * An array of `id`s of elements that provide an accessible description.
   */
  messageIds: Accessor<string[]>;
  setMessageIds: Setter<string[]>;
  getDescriptionProps: (externalProps: Record<string, any>) => Record<string, any>;
}

export const LabelableContext = createContext<LabelableContext>({
  controlId: () => undefined,
  registerControlId: NOOP,
  resetControlId: NOOP,
  labelId: () => undefined,
  setLabelId: NOOP_SETTER,
  messageIds: () => EMPTY_ARRAY as string[],
  setMessageIds: NOOP_SETTER,
  getDescriptionProps: (externalProps: Record<string, any>) => externalProps,
});

export function useLabelableContext(): LabelableContext {
  return useContext(LabelableContext);
}

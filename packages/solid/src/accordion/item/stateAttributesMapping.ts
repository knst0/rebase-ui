import { collapsibleOpenStateMapping as baseMapping } from "../../internals/collapsibleOpenStateMapping";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { transitionStatusMapping } from "../../internals/transition-status";
import type { AccordionItemState } from "./AccordionItem";
import * as AccordionItemDataAttributes from "./AccordionItemDataAttributes";

export const accordionStateAttributesMapping: StateAttributesMapping<AccordionItemState> = {
  ...baseMapping,
  index: {
    keys: [AccordionItemDataAttributes.index],
    map: (value) => ({ [AccordionItemDataAttributes.index]: String(value) }),
  },
  ...transitionStatusMapping,
  value: { keys: [], map: () => null },
};

import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { ScrollAreaRootState } from "./ScrollAreaRoot";
import * as ScrollAreaRootDataAttributes from "./ScrollAreaRootDataAttributes";

const nullMapping = { keys: [], map: () => null };

function booleanAttribute(name: string) {
  return { keys: [name], map: (value: boolean) => (value ? { [name]: "" } : null) };
}

// `scrolling`, `hovering`, and `orientation` intentionally use the default
// mapping (`data-scrolling`, `data-hovering`, `data-orientation`), mirroring upstream.
export const scrollAreaStateAttributesMapping: StateAttributesMapping<ScrollAreaRootState> = {
  hasOverflowX: booleanAttribute(ScrollAreaRootDataAttributes.hasOverflowX),
  hasOverflowY: booleanAttribute(ScrollAreaRootDataAttributes.hasOverflowY),
  overflowXStart: booleanAttribute(ScrollAreaRootDataAttributes.overflowXStart),
  overflowXEnd: booleanAttribute(ScrollAreaRootDataAttributes.overflowXEnd),
  overflowYStart: booleanAttribute(ScrollAreaRootDataAttributes.overflowYStart),
  overflowYEnd: booleanAttribute(ScrollAreaRootDataAttributes.overflowYEnd),
  cornerHidden: nullMapping,
};

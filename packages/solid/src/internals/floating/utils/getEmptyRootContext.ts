import type { FloatingRootContext, TriggerElementsMap } from "../types";

// Minimal trigger registry backing the empty root context until the popup
// `PopupTriggerMap` group is ported. It implements the structural
// `TriggerElementsMap` surface used by the floating utilities.
class EmptyTriggerElementsMap implements TriggerElementsMap {
  private idMap = new Map<string, Element>();

  public add(id: string, element: Element) {
    this.idMap.set(id, element);
  }

  public delete(id: string) {
    this.idMap.delete(id);
  }

  public hasElement(element: Element): boolean {
    for (const registered of this.idMap.values()) {
      if (registered === element) {
        return true;
      }
    }
    return false;
  }

  public entries(): IterableIterator<[string, Element]> {
    return this.idMap.entries();
  }
}

export function getEmptyRootContext(): FloatingRootContext {
  return {
    open: false,
    transitionStatus: undefined,
    floatingElement: null,
    referenceElement: null,
    triggerElements: new EmptyTriggerElementsMap(),
    floatingId: undefined,
    syncOnly: false,
    nested: false,
    onOpenChange: undefined,
  };
}

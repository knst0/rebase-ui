import type { AdaptiveOriginMiddleware } from "../../internals/anchor-positioning/adaptiveOrigin";
import { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import { PopupTriggerMap } from "../../internals/floating/triggerMap";
import { PopupStore } from "../../internals/popups/PopupStore";
import { createInitialPopupStoreState, popupStoreSelectors, type PopupStoreContext } from "../../internals/popups/popupStoreState";
import type { MenuRoot } from "../root/MenuRoot";

export type MenuInteractionType = "keyboard" | "mouse" | "touch" | "pen" | "";

export type MenuStoreState<Payload> = import("../../internals/popups/popupStoreState").PopupStoreState<Payload> & {
  disabled: boolean;
  modal: boolean | undefined;
  openMethod: MenuInteractionType | null;
  allowMouseEnter: boolean;
  highlightItemOnHover: boolean;
  parent: MenuParent;
  rootId: string | undefined;
  activeIndex: number | null;
  hoverEnabled: boolean;
  instantType: "dismiss" | "click" | "group" | "trigger-change" | undefined;
  openChangeReason: MenuRoot.ChangeEventReason | null;
  floatingTreeRoot: FloatingTreeStore;
  floatingNodeId: string | undefined;
  floatingParentNodeId: string | null;
  itemProps: Record<string, any>;
  closeDelay: number;
  openOnHover: boolean;
  keyboardEventRelay: ((event: KeyboardEvent) => void) | undefined;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

export type MenuStoreContext = PopupStoreContext<MenuRoot.ChangeEventDetails> & {
  readonly positionerRef: { current: HTMLElement | null };
  readonly typingRef: { current: boolean };
  readonly itemDomElements: { current: Array<HTMLElement | null> };
  readonly itemLabels: { current: Array<string | null> };
  allowMouseUpTriggerRef: { current: boolean };
  readonly triggerFocusTargetRef: { current: HTMLElement | null };
  readonly beforeContentFocusGuardRef: { current: HTMLElement | null };
};

const menuStoreSelectors = {
  ...popupStoreSelectors,
  disabled: (state: MenuStoreState<unknown>) => state.disabled,
  modal: (state: MenuStoreState<unknown>) => state.parent.type === undefined && (state.modal ?? true),
  openMethod: (state: MenuStoreState<unknown>) => state.openMethod,
  allowMouseEnter: (state: MenuStoreState<unknown>) => state.allowMouseEnter,
  highlightItemOnHover: (state: MenuStoreState<unknown>) => state.highlightItemOnHover,
  parent: (state: MenuStoreState<unknown>) => state.parent,
  rootId: (state: MenuStoreState<unknown>): string | undefined => {
    if (state.parent.type === "menu") {
      return state.parent.store.select("rootId") as string | undefined;
    }

    return state.rootId;
  },
  activeIndex: (state: MenuStoreState<unknown>) => state.activeIndex,
  isActive: (state: MenuStoreState<unknown>, itemIndex: number) => state.activeIndex === itemIndex,
  hoverEnabled: (state: MenuStoreState<unknown>) => state.hoverEnabled,
  instantType: (state: MenuStoreState<unknown>) => state.instantType,
  lastOpenChangeReason: (state: MenuStoreState<unknown>) => state.openChangeReason,
  floatingTreeRoot: (state: MenuStoreState<unknown>): FloatingTreeStore => {
    if (state.parent.type === "menu") {
      return state.parent.store.select("floatingTreeRoot") as FloatingTreeStore;
    }

    return state.floatingTreeRoot;
  },
  floatingNodeId: (state: MenuStoreState<unknown>) => state.floatingNodeId,
  floatingParentNodeId: (state: MenuStoreState<unknown>) => state.floatingParentNodeId,
  itemProps: (state: MenuStoreState<unknown>) => state.itemProps,
  closeDelay: (state: MenuStoreState<unknown>) => state.closeDelay,
  openOnHover: (state: MenuStoreState<unknown>) => state.openOnHover,
  adaptiveOrigin: (state: MenuStoreState<unknown>): AdaptiveOriginMiddleware | undefined => state.adaptiveOrigin,
  keyboardEventRelay: (state: MenuStoreState<unknown>): ((event: KeyboardEvent) => void) | undefined => {
    if (state.keyboardEventRelay) {
      return state.keyboardEventRelay;
    }

    if (state.parent.type === "menu") {
      return state.parent.store.select("keyboardEventRelay") as ((event: KeyboardEvent) => void) | undefined;
    }

    return undefined;
  },
};

export type MenuStoreSelectors = typeof menuStoreSelectors;

export class MenuStore<Payload = unknown> extends PopupStore<MenuStoreState<Payload>, MenuStoreSelectors, MenuStoreContext> {
  constructor(initialState: Partial<MenuStoreState<Payload>>, floatingId: string | undefined, nested: boolean) {
    const triggerElements = new PopupTriggerMap();
    super(
      createInitialState<Payload>(initialState, triggerElements, floatingId, nested),
      createInitialContext(triggerElements, initialState.parent),
      menuStoreSelectors as MenuStoreSelectors,
    );
  }

  setOpen = (open: boolean, eventDetails: Omit<MenuRoot.ChangeEventDetails, "preventUnmountOnClose">) => {
    this.peekState().floatingRootContext.context.events.emit("setOpen", { open, eventDetails });
  };
}

function createInitialState<Payload>(
  initialState: Partial<MenuStoreState<Payload>> | undefined,
  triggerElements: PopupTriggerMap,
  floatingId?: string,
  nested = false,
): MenuStoreState<Payload> {
  const state: MenuStoreState<Payload> = {
    ...createInitialPopupStoreState<Payload>(triggerElements, floatingId, nested),
    disabled: false,
    modal: true,
    openMethod: null,
    allowMouseEnter: false,
    highlightItemOnHover: true,
    parent: {
      type: undefined,
    },
    rootId: undefined,
    activeIndex: null,
    hoverEnabled: true,
    instantType: undefined,
    openChangeReason: null,
    floatingTreeRoot: new FloatingTreeStore(),
    floatingNodeId: undefined,
    floatingParentNodeId: null,
    itemProps: {},
    keyboardEventRelay: undefined,
    closeDelay: 0,
    openOnHover: false,
    adaptiveOrigin: undefined,
    ...initialState,
  };

  if (state.open && initialState?.mounted === undefined) {
    state.mounted = true;
  }

  return state;
}

function createInitialContext(triggerElements: PopupTriggerMap, parent: MenuParent | undefined): MenuStoreContext {
  return {
    positionerRef: { current: null },
    popupRef: { current: null },
    onOpenChange: undefined,
    onOpenChangeComplete: undefined,
    typingRef: { current: false },
    itemDomElements: { current: [] },
    itemLabels: { current: [] },
    // A submenu shares the parent's flag so a press-drag-release gesture that starts on the
    // parent menu's trigger and ends on a submenu item activates the item.
    allowMouseUpTriggerRef: parent?.type === "menu" ? parent.store.context.allowMouseUpTriggerRef : { current: false },
    triggerFocusTargetRef: { current: null },
    beforeContentFocusGuardRef: { current: null },
    triggerElements,
  };
}

/**
 * Groups all parts of a menu, or nests a menu inside another menu as a submenu.
 * `menubar` and `context-menu` parents are not supported yet: those components have not been
 * ported, so only a parent menu (submenu) or no parent (top-level menu) is represented.
 */
export type MenuParent =
  | {
      type: "menu";
      store: MenuStore<unknown>;
    }
  | {
      type: undefined;
    };

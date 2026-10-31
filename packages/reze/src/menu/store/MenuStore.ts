import type { ContextMenuRootContext } from "../../context-menu/root/ContextMenuRootContext";
import type { AdaptiveOriginMiddleware } from "../../internals/anchor-positioning/adaptiveOrigin";
import { REASONS } from "../../internals/event-details";
import { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import { PopupTriggerMap } from "../../internals/floating/triggerMap";
import { PopupStore } from "../../internals/popups/PopupStore";
import { createInitialPopupStoreState, popupStoreSelectors, type PopupStoreContext } from "../../internals/popups/popupStoreState";
import { platform } from "../../internals/utils/platform";
import type { MenubarContext } from "../../menubar/MenubarContext";
import type { MenuRoot } from "../root/MenuRoot";

export type MenuInteractionType = "keyboard" | "mouse" | "touch" | "pen" | "";

export type MenuStoreState<Payload> = import("../../internals/popups/popupStoreState").PopupStoreState<Payload> & {
  disabled: boolean;
  modal: boolean | undefined;
  openMethod: MenuInteractionType | null;
  /** Whether the popup last opened from the keyboard or an assistive-technology press. */
  keyboardOpen: boolean;
  allowMouseEnter: boolean;
  highlightItemOnHover: boolean;
  parent: MenuParent;
  rootId: string | undefined;
  activeIndex: number | null;
  /** The `Menu.List` element, which takes the `menu` role from the popup when rendered. */
  listElement: HTMLElement | null;
  /**
   * Props a filter root adds to its triggers (dialog semantics and the key relay to the input).
   * Published by the filter implementation so a plain menu never bundles them.
   */
  filterTriggerProps: Record<string, any>;
  /** List navigation props for the element that holds real focus under virtual focus. */
  inputProps: Record<string, any>;
  /** Whether this menu's filter input has focus. */
  inputFocused: boolean;
  /** The element at `activeIndex` once the item list settles. Only virtual focus publishes it. */
  highlightedItem: HTMLElement | undefined;
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
  /** Why the next `activeIndex` write happens, consumed by `onItemHighlighted` on commit. */
  highlightReason: MenuRoot.HighlightEventReason;
  /** The event that caused the next `activeIndex` write, reported along with `highlightReason`. */
  highlightEvent: Event | undefined;
  /** The item last committed as highlighted, kept in every menu so reasons compare against it. */
  reportedItem: HTMLElement | undefined;
  /** Re-emits `onItemHighlighted` once the item registry settles. Set by the menu root. */
  syncHighlightedItem: (() => void) | undefined;
  allowMouseUpTriggerRef: { current: boolean };
  /** The element that holds real focus while virtual list navigation is active. */
  virtualFocusRef: { current: HTMLElement | null } | undefined;
  /** Whether a filterable menu's trigger was last pressed by a screen reader. */
  virtualPress?: boolean | undefined;
  readonly triggerFocusTargetRef: { current: HTMLElement | null };
  readonly beforeTriggerFocusGuardRef: { current: HTMLElement | null };
  readonly beforeContentFocusGuardRef: { current: HTMLElement | null };
};

const menuStoreSelectors = {
  ...popupStoreSelectors,
  disabled: (state: MenuStoreState<unknown>) => (state.parent.type === "menubar" && state.parent.context.disabled()) || state.disabled,
  modal: (state: MenuStoreState<unknown>) =>
    (state.parent.type === undefined || state.parent.type === "context-menu") && (state.modal ?? true),
  openMethod: (state: MenuStoreState<unknown>) => state.openMethod,
  keyboardOpen: (state: MenuStoreState<unknown>) => state.keyboardOpen,
  allowMouseEnter: (state: MenuStoreState<unknown>) => state.allowMouseEnter,
  highlightItemOnHover: (state: MenuStoreState<unknown>) => state.highlightItemOnHover,
  parent: (state: MenuStoreState<unknown>) => state.parent,
  rootId: (state: MenuStoreState<unknown>): string | undefined => {
    if (state.parent.type === "menu") {
      return state.parent.store.select("rootId") as string | undefined;
    }

    return state.parent.type === "menubar" ? state.parent.context.rootId : state.rootId;
  },
  activeIndex: (state: MenuStoreState<unknown>) => state.activeIndex,
  listElement: (state: MenuStoreState<unknown>) => state.listElement,
  /** The trigger's `aria-controls`: the list when one holds the `menu` role, else the popup. */
  triggerControlsId: (state: MenuStoreState<unknown>, triggerId: string | undefined) => {
    const popupId = popupStoreSelectors.triggerPopupId(state, triggerId);
    return popupId ? state.listElement?.id || popupId : undefined;
  },
  filterTriggerProps: (state: MenuStoreState<unknown>) => state.filterTriggerProps,
  inputProps: (state: MenuStoreState<unknown>) => state.inputProps,
  inputFocused: (state: MenuStoreState<unknown>) => state.inputFocused,
  highlightedItem: (state: MenuStoreState<unknown>) => state.highlightedItem,
  // `aria-selected` is invalid on `menuitem`, but Safari VoiceOver needs it for arrow-key
  // navigation. Limit it to WebKit while the input has focus so normal VoiceOver navigation
  // does not encounter the invalid attribute.
  webkitAriaSelected: (state: MenuStoreState<unknown>, highlighted: boolean) =>
    platform.engine.webkit && state.inputFocused && highlighted ? true : undefined,
  highlightedItemId: (state: MenuStoreState<unknown>) => state.highlightedItem?.id || undefined,
  isActive: (state: MenuStoreState<unknown>, itemIndex: number) => state.activeIndex === itemIndex,
  hoverEnabled: (state: MenuStoreState<unknown>) => state.hoverEnabled,
  // `trigger-change` describes a popup moving between triggers, which only has
  // meaning while it is open. Dropping it once closed keeps a late or stale
  // restoration from marking a closing popup instant and skipping its exit
  // transition, including on close paths that never reach `setOpen` — a
  // controlled consumer committing `open={false}` goes straight through the prop.
  instantType: (state: MenuStoreState<unknown>) =>
    state.instantType === "trigger-change" && !popupStoreSelectors.open(state) ? undefined : state.instantType,
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

  setActiveIndex(activeIndex: number | null, reason: MenuRoot.HighlightEventReason = REASONS.none, event?: Event) {
    // Only a write that changes the index is reported. Tagging a no-op, or a write back to the
    // reported item before the change commits, would let a later registry-driven re-emit report
    // this reason instead of `none`.
    if (this.peekState().activeIndex !== activeIndex) {
      const item = activeIndex === null ? undefined : this.context.itemDomElements.current[activeIndex];
      const isWriteBack = item === this.context.reportedItem;
      this.context.highlightReason = isWriteBack ? REASONS.none : reason;
      this.context.highlightEvent = isWriteBack ? undefined : event;
    }
    if (this.peekState().activeIndex !== activeIndex) {
      this.set("activeIndex", activeIndex);
    }
  }

  highlightItem(element: Element | null, reason: MenuRoot.HighlightEventReason = REASONS.none, event?: Event) {
    const index = this.context.itemDomElements.current.indexOf(element as HTMLElement);
    if (index > -1) {
      this.setActiveIndex(index, reason, event);
    }
  }
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
    keyboardOpen: false,
    allowMouseEnter: false,
    highlightItemOnHover: true,
    parent: {
      type: undefined,
    },
    rootId: undefined,
    activeIndex: null,
    listElement: null,
    filterTriggerProps: {},
    inputProps: {},
    inputFocused: false,
    highlightedItem: undefined,
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
    highlightReason: REASONS.none,
    highlightEvent: undefined,
    reportedItem: undefined,
    syncHighlightedItem: undefined,
    // A submenu shares the parent's flag so a press-drag-release gesture that starts on the
    // parent menu's trigger and ends on a submenu item activates the item.
    allowMouseUpTriggerRef:
      parent?.type === "menu"
        ? parent.store.context.allowMouseUpTriggerRef
        : parent?.type !== undefined
          ? parent.context.allowMouseUpTriggerRef
          : { current: false },
    virtualFocusRef: undefined,
    triggerFocusTargetRef: { current: null },
    beforeTriggerFocusGuardRef: { current: null },
    beforeContentFocusGuardRef: { current: null },
    triggerElements,
  };
}

/**
 * What a menu is nested in: another menu (submenu), a menubar, a context menu, or nothing.
 */
export type MenuParent =
  | {
      type: "menu";
      store: MenuStore<unknown>;
    }
  | {
      type: "menubar";
      context: MenubarContext;
    }
  | {
      type: "context-menu";
      context: ContextMenuRootContext;
    }
  | {
      type: undefined;
    };

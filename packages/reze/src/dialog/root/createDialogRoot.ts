import { createUniqueId, effect, onCleanup, store, untrack } from "reze-js";

import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { createScrollLock } from "../../internals/scroll-lock";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import { contains } from "../../internals/utils/contains";
import type { DialogHandle } from "../store/DialogHandle";
import type { DialogRoot } from "./DialogRoot";

/**
 * How the dialog was opened. Used to resolve functional `initialFocus`/`finalFocus` props.
 */
export type DialogInteractionType = "mouse" | "touch" | "pen" | "keyboard";

export interface CreateDialogRootParameters {
  open: () => boolean | undefined;
  defaultOpen: () => boolean;
  modal: () => boolean | "trap-focus";
  disablePointerDismissal: () => boolean;
  onOpenChange: (open: boolean, eventDetails: DialogRoot.ChangeEventDetails) => void;
  onOpenChangeComplete: (open: boolean) => void;
  triggerId: () => string | null | undefined;
  role: "dialog" | "alertdialog";
  parentContext?: CreateDialogRootReturnValue | undefined;
  /**
   * Marks the root as a drawer so nesting is reported to the parent as a nested
   * drawer rather than a nested dialog. Used by `Drawer.Root`.
   */
  isDrawer?: boolean | undefined;
}

export interface CreateDialogRootReturnValue {
  open: () => boolean;
  mounted: () => boolean;
  /**
   * Whether the dialog has finished closing (close animations settled).
   * Used to hide kept-mounted popups only after their exit transition.
   */
  closeSettled: () => boolean;
  transitionStatus: () => TransitionStatus;
  nested: boolean;
  nestedOpenDialogCount: () => number;
  /**
   * Number of open nested drawers. Tracked separately from nested dialogs so
   * drawer parts can react to nested drawers specifically.
   */
  nestedOpenDrawerCount: () => number;
  /**
   * Gate for outside-press dismissal. `Drawer.SwipeArea` disables it while a
   * swipe-open gesture is in flight so the release click cannot synchronously
   * dismiss the drawer it just opened.
   */
  outsidePressEnabled: () => boolean;
  setOutsidePressEnabled: (enabled: boolean) => void;
  modal: () => boolean | "trap-focus";
  disablePointerDismissal: () => boolean;
  role: "dialog" | "alertdialog";
  popupId: string;
  titleElementId: () => string | undefined;
  descriptionElementId: () => string | undefined;
  setTitleElementId: (id: string | undefined) => void;
  setDescriptionElementId: (id: string | undefined) => void;
  activeTriggerId: () => string | null | undefined;
  activeTriggerElement: () => HTMLElement | null | undefined;
  payload: () => unknown;
  openMethod: () => DialogInteractionType;
  popupElement: () => HTMLElement | null;
  backdropElement: () => HTMLDivElement | null;
  internalBackdropElement: () => HTMLDivElement | null;
  viewportElement: () => HTMLDivElement | null;
  setPopupElement: (element: HTMLElement | null) => void;
  setBackdropElement: (element: HTMLDivElement | null) => void;
  setInternalBackdropElement: (element: HTMLDivElement | null) => void;
  setViewportElement: (element: HTMLDivElement | null) => void;
  state: DialogRoot.State;
  onOpenChange: (open: boolean, eventDetails: DialogRoot.ChangeEventDetails) => void;
  onOpenChangeComplete: (open: boolean) => void;
  setOpen: (nextOpen: boolean, eventDetails: DialogRoot.ChangeEventDetails) => void;
  requestOpenByTrigger: (
    triggerId: string | null,
    triggerElement: HTMLElement | null,
    payload: unknown,
    openMethod: DialogInteractionType,
    eventDetails: DialogRoot.ChangeEventDetails,
  ) => void;
  registerTrigger: (id: string, element: HTMLElement) => () => void;
  registerNestedDialog: () => () => void;
  registerNestedDrawer: () => () => void;
  requestClose: () => void;
  forceUnmount: () => void;
  registerKeepMounted: () => () => void;
  resolveTriggerElement: (id: string) => HTMLElement | undefined;
  attachHandle: (handle: DialogHandle<any>) => void;
  detachHandle: (handle: DialogHandle<any>) => void;
}

export function createDialogRoot(parameters: CreateDialogRootParameters): CreateDialogRootReturnValue {
  const { parentContext, role } = parameters;
  const nested = parentContext !== undefined;
  const popupId = createUniqueId();

  const state = store({
    internalOpen: untrack(parameters.open) ?? untrack(parameters.defaultOpen),
    mounted: false,
    transitionStatus: undefined as TransitionStatus,
    closeSettled: true,
    preventUnmountOnClose: false,
    titleElementId: undefined as string | undefined,
    descriptionElementId: undefined as string | undefined,
    internalActiveTriggerId: undefined as string | null | undefined,
    activeTriggerElement: undefined as HTMLElement | null | undefined,
    payloadVersion: 0,
    openMethod: "keyboard" as DialogInteractionType,
    popupElement: null as HTMLElement | null,
    backdropElement: null as HTMLDivElement | null,
    internalBackdropElement: null as HTMLDivElement | null,
    viewportElement: null as HTMLDivElement | null,
    nestedOpenDialogCount: 0,
    nestedOpenDrawerCount: 0,
    outsidePressEnabled: true,
    keepMountedCount: 0,
  });

  // The payload keeps its identity: it lives outside the store (which would deep-wrap
  // objects) and the store only carries a version counter that bindings subscribe to.
  let payloadValue: unknown;

  const triggerElements = new Map<string, HTMLElement>();

  function open(): boolean {
    return parameters.open() ?? state.internalOpen;
  }

  function mounted(): boolean {
    return state.mounted;
  }

  function closeSettled(): boolean {
    return state.closeSettled;
  }

  function transitionStatus(): TransitionStatus {
    return state.transitionStatus;
  }

  function modal(): boolean | "trap-focus" {
    return parameters.modal() ?? true;
  }

  function disablePointerDismissal(): boolean {
    return parameters.disablePointerDismissal() ?? false;
  }

  function titleElementId(): string | undefined {
    return state.titleElementId;
  }

  function descriptionElementId(): string | undefined {
    return state.descriptionElementId;
  }

  function setTitleElementId(id: string | undefined): void {
    state.titleElementId = id;
  }

  function setDescriptionElementId(id: string | undefined): void {
    state.descriptionElementId = id;
  }

  function activeTriggerId(): string | null | undefined {
    return parameters.triggerId() ?? state.internalActiveTriggerId;
  }

  function activeTriggerElement(): HTMLElement | null | undefined {
    return state.activeTriggerElement;
  }

  function payload(): unknown {
    void state.payloadVersion;
    return payloadValue;
  }

  function openMethod(): DialogInteractionType {
    return state.openMethod;
  }

  function popupElement(): HTMLElement | null {
    return state.popupElement;
  }

  function backdropElement(): HTMLDivElement | null {
    return state.backdropElement;
  }

  function internalBackdropElement(): HTMLDivElement | null {
    return state.internalBackdropElement;
  }

  function viewportElement(): HTMLDivElement | null {
    return state.viewportElement;
  }

  function setPopupElement(element: HTMLElement | null): void {
    state.popupElement = element;
  }

  function setBackdropElement(element: HTMLDivElement | null): void {
    state.backdropElement = element;
  }

  function setInternalBackdropElement(element: HTMLDivElement | null): void {
    state.internalBackdropElement = element;
  }

  function setViewportElement(element: HTMLDivElement | null): void {
    state.viewportElement = element;
  }

  function nestedOpenDialogCount(): number {
    return state.nestedOpenDialogCount;
  }

  function nestedOpenDrawerCount(): number {
    return state.nestedOpenDrawerCount;
  }

  function outsidePressEnabled(): boolean {
    return state.outsidePressEnabled;
  }

  function setOutsidePressEnabled(enabled: boolean): void {
    state.outsidePressEnabled = enabled;
  }

  function setMounted(mounted: boolean): void {
    if (state.mounted !== mounted) {
      state.mounted = mounted;
    }
  }

  function setTransitionStatus(status: TransitionStatus): void {
    if (state.transitionStatus !== status) {
      state.transitionStatus = status;
    }
  }

  function registerKeepMounted(): () => void {
    // Actions never subscribe: without untrack, the read half of += inside an
    // effect would subscribe the effect to the counter it writes (self-loop).
    untrack(() => {
      state.keepMountedCount += 1;
    });

    return () => {
      untrack(() => {
        state.keepMountedCount = Math.max(0, state.keepMountedCount - 1);
      });
    };
  }

  const rootState: DialogRoot.State = {};

  function setOpen(nextOpen: boolean, eventDetails: DialogRoot.ChangeEventDetails) {
    (eventDetails as { preventUnmountOnClose?: () => void }).preventUnmountOnClose = () => {
      state.preventUnmountOnClose = true;
    };

    parameters.onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    if (nextOpen) {
      state.preventUnmountOnClose = false;
    }

    if (parameters.open() === undefined) {
      state.internalOpen = nextOpen;
    }
  }

  function requestOpenByTrigger(
    triggerId: string | null,
    triggerElement: HTMLElement | null,
    nextPayload: unknown,
    nextOpenMethod: DialogInteractionType,
    eventDetails: DialogRoot.ChangeEventDetails,
  ) {
    if (triggerId === null) {
      state.internalActiveTriggerId = null;
      state.activeTriggerElement = null;
    } else {
      state.internalActiveTriggerId = triggerId;
      state.activeTriggerElement = triggerElement ?? triggerElements.get(triggerId) ?? null;
    }

    payloadValue = nextPayload;
    untrack(() => {
      state.payloadVersion += 1;
    });
    state.openMethod = nextOpenMethod;
    setOpen(true, eventDetails);
  }

  function registerTrigger(id: string, element: HTMLElement): () => void {
    triggerElements.set(id, element);

    return () => {
      if (triggerElements.get(id) === element) {
        triggerElements.delete(id);
      }
    };
  }

  function resolveTriggerElement(id: string): HTMLElement | undefined {
    return triggerElements.get(id);
  }

  function registerNestedDialog(): () => void {
    // Actions never subscribe (see registerKeepMounted).
    untrack(() => {
      state.nestedOpenDialogCount += 1;
    });

    return () => {
      untrack(() => {
        state.nestedOpenDialogCount = Math.max(0, state.nestedOpenDialogCount - 1);
      });
    };
  }

  function registerNestedDrawer(): () => void {
    // Actions never subscribe (see registerKeepMounted).
    untrack(() => {
      state.nestedOpenDrawerCount += 1;
    });

    return () => {
      untrack(() => {
        state.nestedOpenDrawerCount = Math.max(0, state.nestedOpenDrawerCount - 1);
      });
    };
  }

  function requestClose() {
    setOpen(false, createChangeEventDetails(REASONS.imperativeAction, undefined, activeTriggerElement() ?? undefined));
  }

  function forceUnmount() {
    state.preventUnmountOnClose = false;
    state.closeSettled = true;
    setMounted(false);
  }

  function attachHandle(handle: DialogHandle<any>) {
    handle.attach(dialog);
  }

  function detachHandle(handle: DialogHandle<any>) {
    handle.detach(dialog);
  }

  const dialog: CreateDialogRootReturnValue = {
    open,
    mounted,
    closeSettled,
    transitionStatus,
    nested,
    nestedOpenDialogCount,
    nestedOpenDrawerCount,
    outsidePressEnabled,
    setOutsidePressEnabled,
    modal,
    disablePointerDismissal,
    role,
    popupId,
    titleElementId,
    descriptionElementId,
    setTitleElementId,
    setDescriptionElementId,
    activeTriggerId,
    activeTriggerElement,
    payload,
    openMethod,
    popupElement,
    backdropElement,
    internalBackdropElement,
    viewportElement,
    setPopupElement,
    setBackdropElement,
    setInternalBackdropElement,
    setViewportElement,
    state: rootState,
    onOpenChange: parameters.onOpenChange,
    onOpenChangeComplete: parameters.onOpenChangeComplete,
    setOpen,
    requestOpenByTrigger,
    registerTrigger,
    registerKeepMounted,
    resolveTriggerElement,
    registerNestedDialog,
    registerNestedDrawer,
    requestClose,
    forceUnmount,
    attachHandle,
    detachHandle,
  };

  // Notify the parent dialog about nested open state so only the topmost dialog
  // handles Escape and outside presses.
  if (parentContext) {
    const isDrawerRoot = parameters.isDrawer ?? false;
    effect(() => {
      if (!open()) {
        return;
      }

      onCleanup(isDrawerRoot ? parentContext.registerNestedDrawer() : parentContext.registerNestedDialog());
    });
  }

  effect(() => {
    if (open() && state.closeSettled) {
      state.closeSettled = false;
    }
  });

  createTransitionStatus({
    open,
    mounted,
    transitionStatus,
    setMounted,
    setTransitionStatus,
  });

  // Unmount after close animations finish, unless unmounting was prevented.
  const runAnimationsFinished = createAnimationsFinishedRunner(() => state.popupElement);

  effect(() => {
    const isOpen = open();
    const isMounted = mounted();
    const status = transitionStatus();

    if (isOpen || !isMounted || status !== "ending") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      runAnimationsFinished(() => {
        if (open()) {
          return;
        }

        if (!closeSettled()) {
          state.closeSettled = true;
        }

        if (state.preventUnmountOnClose || state.keepMountedCount > 0) {
          return;
        }

        setMounted(false);
      });
    });

    onCleanup(() => {
      cancelAnimationFrame(frame);
    });
  });

  // Lock document scroll while a modal dialog is open.
  createScrollLock({ enabled: () => open() && modal() === true });

  // Close the topmost dialog on Escape.
  effect(() => {
    const isOpen = open();
    nestedOpenDialogCount();
    nestedOpenDrawerCount();

    if (!isOpen || typeof document === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || nestedOpenDialogCount() > 0 || nestedOpenDrawerCount() > 0) {
        return;
      }

      setOpen(false, createChangeEventDetails(REASONS.escapeKey, event, activeTriggerElement() ?? undefined));
    };

    document.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Close on outside presses and, for non-modal dialogs, on focus moving outside.
  effect(() => {
    const isOpen = open();
    nestedOpenDialogCount();
    nestedOpenDrawerCount();

    if (!isOpen || typeof document === "undefined") {
      return;
    }

    const isTopmost = () => nestedOpenDialogCount() === 0 && nestedOpenDrawerCount() === 0;

    const handlePointerDown = (event: PointerEvent) => {
      if (!isTopmost() || disablePointerDismissal() || !outsidePressEnabled()) {
        return;
      }

      // Only the primary button (or a single touch) dismisses the dialog.
      if (event.button !== 0) {
        return;
      }

      const target = event.target as Node | null;
      const popup = popupElement();

      if (popup && target && contains(popup, target as Element)) {
        return;
      }

      // Presses on a registered trigger never dismiss: the trigger itself
      // controls opening, and a press that opens the dialog must not
      // synchronously close it again.
      if (target && isTriggerElement(target)) {
        return;
      }

      setOpen(false, createChangeEventDetails(REASONS.outsidePress, event, activeTriggerElement() ?? undefined));
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (!isTopmost() || modal() !== false || disablePointerDismissal()) {
        return;
      }

      const popup = popupElement();
      const relatedTarget = event.relatedTarget as Node | null;

      if (popup && relatedTarget && contains(popup, relatedTarget as Element)) {
        return;
      }

      setOpen(false, createChangeEventDetails(REASONS.focusOut, event, activeTriggerElement() ?? undefined));
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusout", handleFocusOut);

    onCleanup(() => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusout", handleFocusOut);
    });
  });

  function isTriggerElement(target: Node): boolean {
    for (const element of triggerElements.values()) {
      if (element === target || element.contains(target)) {
        return true;
      }
    }

    return false;
  }

  return dialog;
}

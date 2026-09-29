import { type Accessor, createEffect, createSignal, createUniqueId, type Setter, untrack } from "solid-js";

import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { isWithinComponentTree } from "../../internals/floating/utils/element";
import { createScrollLock } from "../../internals/scroll-lock";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
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
  open: Accessor<boolean>;
  mounted: Accessor<boolean>;
  /**
   * Whether the dialog has finished closing (close animations settled).
   * Used to hide kept-mounted popups only after their exit transition.
   */
  closeSettled: Accessor<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
  nested: boolean;
  nestedOpenDialogCount: Accessor<number>;
  /**
   * Number of open nested drawers. Tracked separately from nested dialogs so
   * drawer parts can react to nested drawers specifically.
   */
  nestedOpenDrawerCount: Accessor<number>;
  /**
   * Gate for outside-press dismissal. `Drawer.SwipeArea` disables it while a
   * swipe-open gesture is in flight so the release click cannot synchronously
   * dismiss the drawer it just opened.
   */
  outsidePressEnabled: Accessor<boolean>;
  setOutsidePressEnabled: (enabled: boolean) => void;
  modal: Accessor<boolean | "trap-focus">;
  disablePointerDismissal: Accessor<boolean>;
  role: "dialog" | "alertdialog";
  popupId: Accessor<string>;
  titleElementId: Accessor<string | undefined>;
  descriptionElementId: Accessor<string | undefined>;
  setTitleElementId: Setter<string | undefined>;
  setDescriptionElementId: Setter<string | undefined>;
  activeTriggerId: Accessor<string | null | undefined>;
  activeTriggerElement: Accessor<HTMLElement | null | undefined>;
  payload: Accessor<unknown>;
  openMethod: Accessor<DialogInteractionType>;
  popupElement: Accessor<HTMLElement | null>;
  backdropElement: Accessor<HTMLDivElement | null>;
  internalBackdropElement: Accessor<HTMLDivElement | null>;
  viewportElement: Accessor<HTMLDivElement | null>;
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

  const modal = () => parameters.modal();
  const disablePointerDismissal = () => parameters.disablePointerDismissal();

  const [open, setOpenState] = createControllableSignal({
    value: parameters.open,
    defaultValue: parameters.defaultOpen,
  });

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open);

  const [preventUnmountOnClose, setPreventUnmountOnClose] = createSignal(false);
  const [closeSettled, setCloseSettled] = createSignal(true);
  const popupId = () => dialogPopupId;
  const [titleElementId, setTitleElementId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const [descriptionElementId, setDescriptionElementId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const dialogPopupId = createUniqueId();

  const [internalActiveTriggerId, setInternalActiveTriggerId] = createSignal<string | null | undefined>(undefined);
  const activeTriggerId = () => parameters.triggerId() ?? internalActiveTriggerId();

  const [activeTriggerElement, setActiveTriggerElement] = createSignal<HTMLElement | null | undefined>(undefined);
  const [payload, setPayload] = createSignal<unknown>(undefined);
  const [openMethod, setOpenMethod] = createSignal<DialogInteractionType>("keyboard");

  const triggerElements = new Map<string, HTMLElement>();

  const [popupElement, setPopupElement] = createSignal<HTMLElement | null>(null);
  const [backdropElement, setBackdropElement] = createSignal<HTMLDivElement | null>(null);
  const [internalBackdropElement, setInternalBackdropElement] = createSignal<HTMLDivElement | null>(null);
  const [viewportElement, setViewportElement] = createSignal<HTMLDivElement | null>(null);

  const [nestedOpenDialogCount, setNestedOpenDialogCount] = createSignal(0);
  const [nestedOpenDrawerCount, setNestedOpenDrawerCount] = createSignal(0);
  const [outsidePressEnabled, setOutsidePressEnabled] = createSignal(true);
  const [keepMountedCount, setKeepMountedCount] = createSignal(0);

  function registerKeepMounted(): () => void {
    setKeepMountedCount((count) => count + 1);

    return () => {
      setKeepMountedCount((count) => Math.max(0, count - 1));
    };
  }

  const state: DialogRoot.State = {};

  function setOpen(nextOpen: boolean, eventDetails: DialogRoot.ChangeEventDetails) {
    (eventDetails as { preventUnmountOnClose?: () => void }).preventUnmountOnClose = () => {
      setPreventUnmountOnClose(true);
    };

    parameters.onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    if (nextOpen) {
      setPreventUnmountOnClose(false);
      setCloseSettled(false);
    }

    setOpenState(nextOpen);
  }

  function requestOpenByTrigger(
    triggerId: string | null,
    triggerElement: HTMLElement | null,
    nextPayload: unknown,
    nextOpenMethod: DialogInteractionType,
    eventDetails: DialogRoot.ChangeEventDetails,
  ) {
    if (triggerId === null) {
      setInternalActiveTriggerId(null);
      setActiveTriggerElement(null);
    } else {
      setInternalActiveTriggerId(triggerId);
      setActiveTriggerElement(triggerElement ?? triggerElements.get(triggerId) ?? null);
    }

    setPayload(nextPayload);
    setOpenMethod(nextOpenMethod);
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
    setNestedOpenDialogCount((count) => count + 1);

    return () => {
      setNestedOpenDialogCount((count) => Math.max(0, count - 1));
    };
  }

  function registerNestedDrawer(): () => void {
    setNestedOpenDrawerCount((count) => count + 1);

    return () => {
      setNestedOpenDrawerCount((count) => Math.max(0, count - 1));
    };
  }

  function requestClose() {
    setOpen(false, createChangeEventDetails(REASONS.imperativeAction, undefined, untrack(activeTriggerElement) ?? undefined));
  }

  function forceUnmount() {
    setPreventUnmountOnClose(false);
    setCloseSettled(true);
    setMounted(false);
  }

  function attachHandle(handle: DialogHandle<any>) {
    handle.attach(store);
  }

  function detachHandle(handle: DialogHandle<any>) {
    handle.detach(store);
  }

  const store: CreateDialogRootReturnValue = {
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
    state,
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
    const isDrawerRoot = untrack(() => parameters.isDrawer) ?? false;
    createEffect(
      () => open(),
      (isOpen) => {
        if (!isOpen) {
          return undefined;
        }

        return isDrawerRoot ? parentContext.registerNestedDrawer() : parentContext.registerNestedDialog();
      },
    );
  }

  // Unmount after close animations finish, unless unmounting was prevented.
  const runAnimationsFinished = createAnimationsFinishedRunner(popupElement);

  createEffect(
    () => ({ isOpen: open(), isMounted: mounted(), status: transitionStatus() }),
    ({ isOpen, isMounted, status }) => {
      if (isOpen || !isMounted || status !== "ending") {
        return undefined;
      }

      let frame: number | undefined = requestAnimationFrame(() => {
        frame = undefined;
        runAnimationsFinished(() => {
          if (untrack(open)) {
            return;
          }

          setCloseSettled(true);

          if (untrack(preventUnmountOnClose) || untrack(keepMountedCount) > 0) {
            return;
          }

          setMounted(false);
        });
      });

      return () => {
        if (frame !== undefined) {
          cancelAnimationFrame(frame);
        }
      };
    },
  );

  // Lock document scroll while a modal dialog is open.
  createScrollLock({ enabled: () => open() && modal() === true });

  // Close the topmost dialog on Escape.
  createEffect(
    () => ({ isOpen: open(), nestedCount: nestedOpenDialogCount(), nestedDrawerCount: nestedOpenDrawerCount() }),
    ({ isOpen }) => {
      if (!isOpen || typeof document === "undefined") {
        return undefined;
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || untrack(nestedOpenDialogCount) > 0 || untrack(nestedOpenDrawerCount) > 0) {
          return;
        }

        setOpen(false, createChangeEventDetails(REASONS.escapeKey, event, untrack(activeTriggerElement) ?? undefined));
      };

      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    },
  );

  // Close on outside presses and, for non-modal dialogs, on focus moving outside.
  createEffect(
    () => ({ isOpen: open(), nestedCount: nestedOpenDialogCount(), nestedDrawerCount: nestedOpenDrawerCount() }),
    ({ isOpen }) => {
      if (!isOpen || typeof document === "undefined") {
        return undefined;
      }

      const isTopmost = () => untrack(nestedOpenDialogCount) === 0 && untrack(nestedOpenDrawerCount) === 0;

      const handlePointerDown = (event: PointerEvent) => {
        if (!isTopmost() || untrack(disablePointerDismissal) || !untrack(outsidePressEnabled)) {
          return;
        }

        // Only the primary button (or a single touch) dismisses the dialog.
        if (event.button !== 0) {
          return;
        }

        const target = event.target as Node | null;
        const popup = untrack(popupElement);

        if (popup && target && isWithinComponentTree(popup, target)) {
          return;
        }

        // Presses on a registered trigger never dismiss: the trigger itself
        // controls opening, and a press that opens the dialog must not
        // synchronously close it again.
        if (target && isTriggerElement(target)) {
          return;
        }

        setOpen(false, createChangeEventDetails(REASONS.outsidePress, event, untrack(activeTriggerElement) ?? undefined));
      };

      const handleFocusOut = (event: FocusEvent) => {
        if (!isTopmost() || untrack(modal) !== false || untrack(disablePointerDismissal)) {
          return;
        }

        const popup = untrack(popupElement);
        const relatedTarget = event.relatedTarget as Node | null;

        if (popup && relatedTarget && isWithinComponentTree(popup, relatedTarget)) {
          return;
        }

        setOpen(false, createChangeEventDetails(REASONS.focusOut, event, untrack(activeTriggerElement) ?? undefined));
      };

      document.addEventListener("pointerdown", handlePointerDown, true);
      document.addEventListener("focusout", handleFocusOut);

      return () => {
        document.removeEventListener("pointerdown", handlePointerDown, true);
        document.removeEventListener("focusout", handleFocusOut);
      };
    },
  );

  function isTriggerElement(target: Node): boolean {
    for (const element of triggerElements.values()) {
      if (element === target || element.contains(target)) {
        return true;
      }
    }

    return false;
  }

  return store;
}

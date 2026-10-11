import { effect, getOwner, onCleanup, runWithOwner, untrack, type JSX } from "reze-js";

import { createDialogRoot } from "../../dialog/root/createDialogRoot";
import type { DialogRoot as DialogRootNamespace } from "../../dialog/root/DialogRoot";
import { DialogRootContext, useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { stableCallback } from "../../internals/stableCallback";
import { NOOP } from "../../internals/utils/empty";
import { ownerDocument } from "../../internals/utils/owner";
import type { DrawerHandle } from "../handle";
import { useDrawerProviderContext } from "../provider/DrawerProviderContext";
import { createDrawerRoot } from "./createDrawerRoot";
import { DrawerRootContext } from "./DrawerRootContext";

/**
 * Groups all parts of the drawer.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerRoot<Payload = unknown>(props: DrawerRoot.Props<Payload>) {
  const parentContext = useDialogRootContext(true);

  const onOpenChange = stableCallback(() => props.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => props.onOpenChangeComplete);
  const onSnapPointChange = stableCallback(() => props.onSnapPointChange);

  const handleOpenChange = (nextOpen: boolean, eventDetails: DialogRootNamespace.ChangeEventDetails) => {
    const drawerDetails = eventDetails as unknown as DrawerRoot.ChangeEventDetails;
    onOpenChange(nextOpen, drawerDetails);

    if (drawerDetails.isCanceled) {
      return;
    }

    const snapPoints = untrack(() => props.snapPoints);
    if (!nextOpen && snapPoints && snapPoints.length > 0) {
      drawer.setActiveSnapPoint(
        untrack(() => props.defaultSnapPoint) ?? snapPoints[0] ?? null,
        createChangeEventDetails(
          drawerDetails.reason,
          drawerDetails.event as PointerEvent,
          drawerDetails.trigger as HTMLElement | undefined,
        ) as DrawerRoot.SnapPointChangeEventDetails,
      );
    }
  };

  const dialog = createDialogRoot({
    defaultOpen: () => props.defaultOpen ?? false,
    disablePointerDismissal: () => props.disablePointerDismissal ?? false,
    modal: () => props.modal ?? true,
    onOpenChange: handleOpenChange,
    onOpenChangeComplete,
    open: () => props.open,
    parentContext: parentContext ?? undefined,
    role: "dialog",
    triggerId: () => props.triggerId,
    isDrawer: true,
  });

  const drawer = createDrawerRoot({
    swipeDirection: () => props.swipeDirection ?? "down",
    snapToSequentialPoints: () => props.snapToSequentialPoints ?? false,
    snapPoints: () => props.snapPoints,
    snapPoint: () => props.snapPoint,
    defaultSnapPoint: () => props.defaultSnapPoint,
    onSnapPointChange,
  });

  const handle = props.handle;
  if (handle) {
    effect(() => {
      dialog.attachHandle(handle);

      onCleanup(() => {
        dialog.detachHandle(handle);
      });
    });
  }

  const actionsRef = props.actionsRef;
  if (actionsRef) {
    effect(() => {
      actionsRef({
        unmount: dialog.forceUnmount,
        close: dialog.requestClose,
      });

      onCleanup(() => {
        actionsRef(null);
      });
    });
  }

  return (
    <DialogRootContext value={dialog}>
      <DrawerRootContext
        value={{
          swipeDirection: drawer.swipeDirection,
          swipeAreaActiveRef: drawer.swipeAreaActiveRef,
          snapToSequentialPoints: drawer.snapToSequentialPoints,
          snapPoints: drawer.snapPoints,
          activeSnapPoint: drawer.activeSnapPoint,
          setActiveSnapPoint: drawer.setActiveSnapPoint,
          frontmostHeight: drawer.frontmostHeight,
          popupHeight: drawer.popupHeight,
          hasNestedDrawer: drawer.hasNestedDrawer,
          nestedSwiping: drawer.nestedSwiping,
          nestedSwipeProgressStore: drawer.nestedSwipeProgressStore,
          onNestedDrawerPresenceChange: drawer.onNestedDrawerPresenceChange,
          onPopupHeightChange: drawer.onPopupHeightChange,
          onNestedFrontmostHeightChange: drawer.onNestedFrontmostHeightChange,
          onNestedSwipingChange: drawer.onNestedSwipingChange,
          onNestedSwipeProgressChange: drawer.onNestedSwipeProgressChange,
          notifyParentFrontmostHeight: drawer.notifyParentFrontmostHeight,
          notifyParentSwipingChange: drawer.notifyParentSwipingChange,
          notifyParentSwipeProgressChange: drawer.notifyParentSwipeProgressChange,
          notifyParentHasNestedDrawer: drawer.notifyParentHasNestedDrawer,
        }}
      >
        <DrawerProviderReporter />
        <DrawerRootContent payload={dialog.payload as () => Payload | undefined}>{props.children}</DrawerRootContent>
      </DrawerRootContext>
    </DialogRootContext>
  );
}

/**
 * Reports the drawer's open state to the nearest `Drawer.Provider` and wires the
 * Android back gesture (CloseWatcher). Rendered inside both dialog and drawer contexts.
 */
function DrawerProviderReporter() {
  const providerContext = useDrawerProviderContext();
  const dialog = useDialogRootContext();

  // Report open state to the provider. The report itself is untracked so the
  // effect subscribes only to the open state.
  effect(() => {
    const open = dialog.open();
    untrack(() => providerContext?.setDrawerOpen(dialog, open));
  });

  onCleanup(() => {
    providerContext?.removeDrawer(dialog);
  });

  effect(() => {
    const open = dialog.open();
    const topmost = dialog.nestedOpenDialogCount() === 0 && dialog.nestedOpenDrawerCount() === 0;

    // CloseWatcher enables the Android back gesture (Chromium-only).
    // Keep this Android-only for now to avoid interfering with Escape/nesting semantics on desktop due to dismiss handling.
    if (!open || !topmost || !isAndroid()) {
      return;
    }

    const popupElement = untrack(dialog.popupElement);
    const win = popupElement ? ownerDocument(popupElement).defaultView : window;
    if (!win) {
      return;
    }

    const CloseWatcherCtor = (win as Window & { CloseWatcher?: (new () => { destroy: () => void }) | undefined }).CloseWatcher;
    if (!CloseWatcherCtor) {
      return;
    }

    function handleCancel(event: Event) {
      if (!untrack(dialog.open)) {
        return;
      }

      const eventDetails: Parameters<typeof dialog.setOpen>[1] = createChangeEventDetails(REASONS.closeWatcher, event);

      if (!event.cancelable) {
        // The browser lets only one close request per user activation be prevented; any further
        // request closes the drawer regardless, like a native `<dialog>`.
        eventDetails.cancel = NOOP;
      }

      dialog.setOpen(false, eventDetails as unknown as DialogRootNamespace.ChangeEventDetails);

      if (eventDetails.isCanceled) {
        // Keeps this watcher active for the next close request.
        event.preventDefault();
      }
    }

    const closeWatcher = new CloseWatcherCtor();
    // The browser destroys the watcher before `close` fires, so the request is handled from
    // `cancel`, where it can still be prevented.
    (closeWatcher as unknown as EventTarget).addEventListener("cancel", handleCancel);

    onCleanup(() => {
      (closeWatcher as unknown as EventTarget).removeEventListener("cancel", handleCancel);
      closeWatcher.destroy();
    });
  });

  return null;
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent ?? "");
}

/**
 * Renders the root children inside the drawer context. Render-prop children are invoked
 * inside a thunk (bound by the renderer) and receive `payload` as a getter, so reading
 * it inside JSX updates the content in place instead of recreating the drawer subtree
 * (which would restart its transitions).
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives (such as
 * the branch backing conditional parts) return thunks, and invoking one here would
 * resolve the subtree one-shot instead of binding it.
 */
export function DrawerRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (args: { payload: Payload | undefined }) => JSX.Element;
    const payload = props.payload;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the drawer context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      payload();

      return runWithOwner(owner, () =>
        render({
          get payload() {
            return payload();
          },
        }),
      );
    };
  }

  return children as JSX.Element;
}

export interface DrawerRootState {}

export interface DrawerRootProps<Payload = unknown> {
  /**
   * Whether the drawer is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the drawer is initially open.
   *
   * To render a controlled drawer, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Determines if the drawer enters a modal state when open.
   * - `true`: user interaction is limited to just the drawer: focus is trapped, document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the drawer, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   * @default true
   */
  modal?: boolean | "trap-focus" | undefined;
  /**
   * Event handler called when the drawer is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: DrawerRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the drawer is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether to prevent the drawer from closing on outside presses.
   * For non-modal drawers, this also prevents the drawer from closing when focus moves outside of it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /**
   * A callback that receives the imperative actions.
   * - `unmount`: Manually unmounts the drawer.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the drawer imperatively when called.
   */
  actionsRef?: ((actions: DrawerRoot.Actions | null) => void) | undefined;
  /**
   * A handle to associate the drawer with a trigger.
   * If specified, allows external triggers to control the drawer's open state.
   * Can be created with the Drawer.createHandle() method.
   */
  handle?: DrawerHandle<Payload> | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled drawer.
   * There's no need to specify this prop when the drawer is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * The content of the drawer.
   * This can be a regular node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  /**
   * The swipe direction used to dismiss the drawer.
   * @default 'down'
   */
  swipeDirection?: DrawerRoot.SwipeDirection | undefined;
  /**
   * Snap points used to position the drawer.
   * Use numbers between 0 and 1 to represent fractions of the viewport height,
   * numbers greater than 1 as pixel values, or strings in `px`/`rem` units
   * (for example, `'148px'` or `'30rem'`).
   */
  snapPoints?: DrawerRoot.SnapPoint[] | undefined;
  /**
   * Disables velocity-based snap skipping so drag distance determines the next snap point.
   * @default false
   */
  snapToSequentialPoints?: boolean | undefined;
  /**
   * The currently active snap point. Use with `onSnapPointChange` to control the snap point.
   */
  snapPoint?: DrawerRoot.SnapPoint | null | undefined;
  /**
   * The initial snap point value when uncontrolled.
   */
  defaultSnapPoint?: DrawerRoot.SnapPoint | null | undefined;
  /**
   * Callback fired when the snap point changes.
   */
  onSnapPointChange?: ((snapPoint: DrawerRoot.SnapPoint | null, eventDetails: DrawerRoot.SnapPointChangeEventDetails) => void) | undefined;
}

export interface DrawerRootActions {
  unmount: () => void;
  close: () => void;
}

export type DrawerRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closeWatcher
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.swipe
  | typeof REASONS.none;

export type DrawerRootChangeEventDetails = RebaseUIChangeEventDetails<
  DrawerRootChangeEventReason,
  {
    preventUnmountOnClose(): void;
  }
>;

export type DrawerRootSnapPointChangeEventReason = DrawerRootChangeEventReason;

export type DrawerRootSnapPointChangeEventDetails = RebaseUIChangeEventDetails<DrawerRootSnapPointChangeEventReason>;

export namespace DrawerRoot {
  export type State = DrawerRootState;
  export type Props<Payload = unknown> = DrawerRootProps<Payload>;
  export type Actions = DrawerRootActions;
  export type ChangeEventReason = DrawerRootChangeEventReason;
  export type ChangeEventDetails = DrawerRootChangeEventDetails;
  export type SnapPointChangeEventReason = DrawerRootSnapPointChangeEventReason;
  export type SnapPointChangeEventDetails = DrawerRootSnapPointChangeEventDetails;
  export type SnapPoint = import("./DrawerRootContext").DrawerSnapPoint;
  export type SwipeDirection = import("./DrawerRootContext").DrawerSwipeDirection;
}

import type { JSX } from "@solidjs/web";
import { createEffect, createMemo, onSettled, type Setter, untrack } from "solid-js";

import { createDialogRoot } from "../../dialog/root/createDialogRoot";
import type { DialogRoot as DialogRootNamespace } from "../../dialog/root/DialogRoot";
import { DialogRootContext, useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { stableCallback } from "../../internals/stableCallback";
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

  const handle = untrack(() => props.handle);
  if (handle) {
    // Attaching writes to state owned by the handle, so it must happen outside
    // the component's owned scope once rendering has settled.
    onSettled(() => {
      dialog.attachHandle(handle);

      return () => {
        dialog.detachHandle(handle);
      };
    });
  }

  const actionsRef = untrack(() => props.actionsRef);
  if (actionsRef) {
    // Delivering the actions is a signal write, so it happens outside the
    // component's owned scope once rendering has settled.
    onSettled(() => {
      actionsRef({
        unmount: dialog.forceUnmount,
        close: dialog.requestClose,
      });

      return () => {
        actionsRef(null);
      };
    });
  }

  // Creates the children inside the provider (so parts resolve the context) without
  // subscribing to signals read while they are created (e.g. `store.mounted()` read by
  // `<Show>` in the portal would otherwise re-create the whole subtree on every open).
  // Only the payload of render-prop children stays reactive.
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
  const store = useDialogRootContext();

  // Report open state to the provider. Reads happen in compute so the effect
  // subscribes; the report itself runs in the untracked apply. `stableCallback`
  // reads its handler signal at call time, so the call is wrapped in `untrack`.
  createEffect(
    () => ({ open: store.open(), store }),
    ({ open, store: dialogStore }) => {
      untrack(() => providerContext?.setDrawerOpen(dialogStore, open));
    },
  );

  onSettled(() => {
    const removeDrawer = providerContext?.removeDrawer;
    if (!removeDrawer) {
      return;
    }

    const dialogStore = untrack(() => store);

    return () => {
      untrack(() => removeDrawer(dialogStore));
    };
  });

  createEffect(
    () => ({ open: store.open(), topmost: store.nestedOpenDialogCount() === 0 && store.nestedOpenDrawerCount() === 0 }),
    ({ open, topmost }) => {
      // CloseWatcher enables the Android back gesture (Chromium-only).
      // Keep this Android-only for now to avoid interfering with Escape/nesting semantics on desktop due to dismiss handling.
      if (!open || !topmost || !isAndroid()) {
        return undefined;
      }

      const popupElement = untrack(store.popupElement);
      const win = popupElement ? ownerDocument(popupElement).defaultView : window;
      if (!win) {
        return undefined;
      }

      const CloseWatcherCtor = (win as Window & { CloseWatcher?: (new () => { destroy: () => void }) | undefined }).CloseWatcher;
      if (!CloseWatcherCtor) {
        return undefined;
      }

      function handleCloseWatcher(event: Event) {
        if (!untrack(store.open)) {
          return;
        }
        store.setOpen(false, createChangeEventDetails(REASONS.closeWatcher, event) as unknown as DialogRootNamespace.ChangeEventDetails);
      }

      const closeWatcher = new CloseWatcherCtor();
      (closeWatcher as unknown as EventTarget).addEventListener("close", handleCloseWatcher);

      return () => {
        (closeWatcher as unknown as EventTarget).removeEventListener("close", handleCloseWatcher);
        closeWatcher.destroy();
      };
    },
  );

  return null;
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent ?? "");
}

/**
 * Renders the root children inside the drawer context. Render-prop children are invoked
 * once and receive `payload` as a getter, so reading it inside JSX updates the content in
 * place instead of recreating the drawer subtree (which would restart its transitions).
 */
function DrawerRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = untrack(() => props.children);

  if (typeof children === "function") {
    const payloadChildren = children;
    const payload = props.payload;

    // The children function runs once: `payload` is exposed as a getter, so only the JSX
    // expressions that read it re-run. The memo is the lazy-creation wrapper the runtime
    // expects and it recomputes only if the children function reads the payload
    // synchronously (e.g. destructuring it), which restores the previous remount behaviour.
    const childrenMemo = createMemo(() =>
      payloadChildren({
        get payload() {
          return payload();
        },
      }),
    );
    return (() => childrenMemo()) as unknown as JSX.Element;
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
   * A signal setter that receives the imperative actions.
   * - `unmount`: Manually unmounts the drawer.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the drawer imperatively when called.
   */
  actionsRef?: Setter<DrawerRoot.Actions | null> | undefined;
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

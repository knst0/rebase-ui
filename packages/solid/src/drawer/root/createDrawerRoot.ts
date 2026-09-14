import { createMemo, createSignal, untrack, type Accessor } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { stableCallback } from "../../internals/stableCallback";
import type { DrawerRoot } from "./DrawerRoot";
import {
  useDrawerRootContext,
  type DrawerNestedSwipeProgressStore,
  type DrawerSnapPoint,
  type DrawerSwipeDirection,
} from "./DrawerRootContext";

export interface CreateDrawerRootParameters {
  swipeDirection: () => DrawerSwipeDirection;
  snapToSequentialPoints: () => boolean;
  snapPoints: () => DrawerSnapPoint[] | undefined;
  snapPoint: () => DrawerSnapPoint | null | undefined;
  defaultSnapPoint: () => DrawerSnapPoint | null | undefined;
  onSnapPointChange: (snapPoint: DrawerSnapPoint | null, eventDetails: DrawerRoot.SnapPointChangeEventDetails) => void;
}

export interface CreateDrawerRootReturnValue {
  swipeDirection: DrawerSwipeDirection;
  swipeAreaActiveRef: { current: boolean };
  snapToSequentialPoints: boolean;
  snapPoints: DrawerSnapPoint[] | undefined;
  activeSnapPoint: Accessor<DrawerSnapPoint | null>;
  setActiveSnapPoint: (snapPoint: DrawerSnapPoint | null, eventDetails?: DrawerRoot.SnapPointChangeEventDetails) => void;
  frontmostHeight: Accessor<number>;
  popupHeight: Accessor<number>;
  hasNestedDrawer: Accessor<boolean>;
  nestedSwiping: Accessor<boolean>;
  nestedSwipeProgressStore: DrawerNestedSwipeProgressStore;
  onNestedDrawerPresenceChange: (present: boolean) => void;
  onPopupHeightChange: (height: number) => void;
  onNestedFrontmostHeightChange: (height: number) => void;
  onNestedSwipingChange: (swiping: boolean) => void;
  onNestedSwipeProgressChange: (progress: number) => void;
  notifyParentFrontmostHeight: ((height: number) => void) | undefined;
  notifyParentSwipingChange: ((swiping: boolean) => void) | undefined;
  notifyParentSwipeProgressChange: ((progress: number) => void) | undefined;
  notifyParentHasNestedDrawer: ((present: boolean) => void) | undefined;
}

interface NestedSwipeProgressStore extends DrawerNestedSwipeProgressStore {
  set: (progress: number) => void;
}

function createNestedSwipeProgressStore(): NestedSwipeProgressStore {
  let progress = 0;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => progress,
    set(nextProgress) {
      const resolved = Number.isFinite(nextProgress) ? nextProgress : 0;
      if (resolved === progress) {
        return;
      }

      progress = resolved;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Creates the drawer-specific state layered on top of the dialog store:
 * snap points, measured heights, and nested-drawer coordination.
 */
export function createDrawerRoot(parameters: CreateDrawerRootParameters): CreateDrawerRootReturnValue {
  const parentDrawerRootContext = useDrawerRootContext(true);

  const notifyParentSwipeProgressChange = parentDrawerRootContext?.onNestedSwipeProgressChange;
  const notifyParentFrontmostHeight = parentDrawerRootContext?.onNestedFrontmostHeightChange;
  const notifyParentSwipingChange = parentDrawerRootContext?.onNestedSwipingChange;
  const notifyParentHasNestedDrawer = parentDrawerRootContext?.onNestedDrawerPresenceChange;

  // Structural props: fixed for the lifetime of the instance.
  const swipeDirection = untrack(parameters.swipeDirection);
  const snapToSequentialPoints = untrack(parameters.snapToSequentialPoints);
  const snapPoints = untrack(parameters.snapPoints);

  const [popupHeight, setPopupHeight] = createSignal(0);
  const [frontmostHeight, setFrontmostHeight] = createSignal(0);
  const [hasNestedDrawer, setHasNestedDrawer] = createSignal(false);
  const [nestedSwiping, setNestedSwiping] = createSignal(false);
  const nestedSwipeProgressStore = createNestedSwipeProgressStore();

  const resolvedDefaultSnapPoint = untrack(() => parameters.defaultSnapPoint() ?? snapPoints?.[0] ?? null);
  const isSnapPointControlled = untrack(() => parameters.snapPoint() !== undefined);

  const [internalSnapPoint, setInternalSnapPoint] = createSignal<DrawerSnapPoint | null>(resolvedDefaultSnapPoint);

  const activeSnapPoint = createMemo(() => {
    const controlled = parameters.snapPoint();
    if (isSnapPointControlled) {
      return controlled ?? null;
    }

    const internal = internalSnapPoint();
    if (!snapPoints || snapPoints.length === 0) {
      return internal;
    }

    if (internal === null || !snapPoints.some((snapPoint) => Object.is(snapPoint, internal))) {
      return resolvedDefaultSnapPoint;
    }

    return internal;
  });

  let isNestedDrawerOpen = false;
  const swipeAreaActiveRef = { current: false };

  const onSnapPointChange = stableCallback(() => parameters.onSnapPointChange);

  function setActiveSnapPoint(nextSnapPoint: DrawerSnapPoint | null, eventDetails?: DrawerRoot.SnapPointChangeEventDetails) {
    const resolvedEventDetails = eventDetails ?? createChangeEventDetails(REASONS.none);

    onSnapPointChange(nextSnapPoint, resolvedEventDetails as DrawerRoot.SnapPointChangeEventDetails);

    if (resolvedEventDetails.isCanceled) {
      return;
    }

    if (!isSnapPointControlled) {
      setInternalSnapPoint(() => nextSnapPoint);
    }
  }

  function onPopupHeightChange(height: number) {
    setPopupHeight(height);

    if (!isNestedDrawerOpen && height > 0) {
      setFrontmostHeight(height);
    }
  }

  function onNestedFrontmostHeightChange(height: number) {
    if (height > 0) {
      isNestedDrawerOpen = true;
      setFrontmostHeight(height);
      return;
    }

    isNestedDrawerOpen = false;
    const currentPopupHeight = untrack(popupHeight);
    if (currentPopupHeight > 0) {
      setFrontmostHeight(currentPopupHeight);
    }
  }

  function onNestedDrawerPresenceChange(present: boolean) {
    setHasNestedDrawer(present);
  }

  function onNestedSwipeProgressChange(progress: number) {
    nestedSwipeProgressStore.set(progress);
    notifyParentSwipeProgressChange?.(progress);
  }

  function onNestedSwipingChange(swiping: boolean) {
    setNestedSwiping(swiping);
    notifyParentSwipingChange?.(swiping);
  }

  return {
    swipeDirection,
    swipeAreaActiveRef,
    snapToSequentialPoints,
    snapPoints,
    activeSnapPoint,
    setActiveSnapPoint,
    frontmostHeight,
    popupHeight,
    hasNestedDrawer,
    nestedSwiping,
    nestedSwipeProgressStore,
    onNestedDrawerPresenceChange,
    onPopupHeightChange,
    onNestedFrontmostHeightChange,
    onNestedSwipingChange,
    onNestedSwipeProgressChange,
    notifyParentFrontmostHeight,
    notifyParentSwipingChange,
    notifyParentSwipeProgressChange,
    notifyParentHasNestedDrawer,
  };
}

export type { DrawerSnapPoint };

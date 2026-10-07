import type { JSX } from "@solidjs/web";
import { createMemo, createSignal } from "solid-js";

import { stableCallback } from "../../internals/stableCallback";
import { DrawerProviderContext, type DrawerVisualState, type DrawerVisualStateStore } from "./DrawerProviderContext";

/**
 * Provides a shared context for coordinating global Drawer UI, such as indent/background effects based on whether any Drawer is open.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerProvider(props: DrawerProvider.Props) {
  const [openDrawers, setOpenDrawers] = createSignal(new Set<object>());
  const visualStateStore = createVisualStateStore();

  const setDrawerOpen = stableCallback(() => (drawer: object, open: boolean) => {
    setOpenDrawers((prev) => {
      if (prev.has(drawer) === open) {
        return prev;
      }

      const next = new Set(prev);
      if (open) {
        next.add(drawer);
      } else {
        next.delete(drawer);
      }
      return next;
    });
  });

  const removeDrawer = stableCallback(() => (drawer: object) => {
    setDrawerOpen(drawer, false);
  });

  const active = createMemo(() => openDrawers().size > 0);

  const contextValue: DrawerProviderContext = {
    setDrawerOpen: (drawer, open) => setDrawerOpen(drawer, open),
    removeDrawer: (drawer) => removeDrawer(drawer),
    active,
    visualStateStore,
  };

  // `props.children` is read here — inside the provider element, not in the body
  // above — so the subtree is created after the context value is set and parts
  // resolve it. Reading it eagerly in the body would create the subtree before
  // the provider exists, leaving every part without the context.
  return <DrawerProviderContext value={contextValue}>{props.children}</DrawerProviderContext>;
}

export interface DrawerProviderState {}

export interface DrawerProviderProps {
  children?: JSX.Element;
}

export namespace DrawerProvider {
  export type State = DrawerProviderState;
  export type Props = DrawerProviderProps;
}

type VisualStateListener = () => void;

function createVisualStateStore(): DrawerVisualStateStore {
  let state: DrawerVisualState = {
    swipeProgress: 0,
    frontmostHeight: 0,
  };
  const listeners = new Set<VisualStateListener>();

  return {
    getSnapshot: () => state,
    set(nextState) {
      let nextSwipeProgress = state.swipeProgress;
      if (nextState.swipeProgress !== undefined) {
        nextSwipeProgress = Number.isFinite(nextState.swipeProgress) ? nextState.swipeProgress : 0;
      }

      let nextFrontmostHeight = state.frontmostHeight;
      if (nextState.frontmostHeight !== undefined) {
        nextFrontmostHeight = Number.isFinite(nextState.frontmostHeight) ? nextState.frontmostHeight : 0;
      }

      if (nextSwipeProgress === state.swipeProgress && nextFrontmostHeight === state.frontmostHeight) {
        return;
      }

      state = {
        swipeProgress: nextSwipeProgress,
        frontmostHeight: nextFrontmostHeight,
      };

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

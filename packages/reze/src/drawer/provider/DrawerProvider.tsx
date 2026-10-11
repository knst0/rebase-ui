import { store, untrack, type JSX } from "reze-js";

import { DrawerProviderContext, type DrawerVisualState, type DrawerVisualStateStore } from "./DrawerProviderContext";

/**
 * Provides a shared context for coordinating global Drawer UI, such as indent/background effects based on whether any Drawer is open.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerProvider(props: DrawerProvider.Props) {
  const openDrawers = new Set<object>();
  // The set keeps its identity: it lives outside the store (which would proxy-wrap
  // it) and the store only carries a version counter that readers subscribe to.
  const state = store({ version: 0 });
  const visualStateStore = createVisualStateStore();

  function setDrawerOpen(drawer: object, open: boolean) {
    if (openDrawers.has(drawer) === open) {
      return;
    }

    if (open) {
      openDrawers.add(drawer);
    } else {
      openDrawers.delete(drawer);
    }

    // Actions never subscribe: without untrack, the read half of += inside the
    // reporter's effect would subscribe that effect to this version counter.
    untrack(() => {
      state.version += 1;
    });
  }

  function removeDrawer(drawer: object) {
    setDrawerOpen(drawer, false);
  }

  function active(): boolean {
    void state.version;
    return openDrawers.size > 0;
  }

  const contextValue: DrawerProviderContext = {
    setDrawerOpen,
    removeDrawer,
    active,
    visualStateStore,
  };

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

import type { JSX } from "@solidjs/web";
import { createEffect, onCleanup, onSettled, untrack } from "solid-js";

import type { ToastManager } from "../createToastManager";
import { ToastStore } from "../store/ToastStore";
import { ToastProviderContext } from "./ToastProviderContext";

/**
 * Provides a context for creating and managing toasts.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastProvider(props: ToastProvider.Props) {
  const store = new ToastStore({
    timeout: untrack(() => props.timeout ?? 5000),
    limit: untrack(() => props.limit ?? 3),
    viewport: null,
    toasts: [],
    hovering: false,
    focused: false,
    isWindowFocused: true,
    prevFocusElement: null,
  });

  onCleanup(store.dispose);

  // `limit` needs custom syncing because changing it must also recompute each
  // toast's `limited` flag; syncing the raw value alone would not do that.
  createEffect(
    () => ({ timeout: props.timeout ?? 5000, limit: props.limit ?? 3 }),
    ({ timeout, limit }) => {
      store.syncProviderProps(timeout, limit);
    },
  );

  const toastManager = untrack(() => props.toastManager);
  if (toastManager) {
    // Subscribing writes store state owned by the provider, so it happens
    // outside the component's owned scope once rendering has settled.
    onSettled(() => {
      const unsubscribe = toastManager[" subscribe"](({ action, options }) => {
        const id = options.id;

        if (action === "promise" && options.promise) {
          void store.promiseToast(options.promise, options);
        } else if (action === "update" && id) {
          store.updateToast(id, options.updates);
        } else if (action === "close") {
          store.closeToast(id);
        } else {
          store.addToast(options);
        }
      });

      return unsubscribe;
    });
  }

  return <ToastProviderContext value={store}>{untrack(() => props.children)}</ToastProviderContext>;
}

export interface ToastProviderState {}

export interface ToastProviderProps {
  children?: JSX.Element;
  /**
   * The default amount of time (in ms) before a toast is auto dismissed.
   * A value of `0` will prevent the toast from being dismissed automatically.
   * @default 5000
   */
  timeout?: number | undefined;
  /**
   * The maximum number of toasts that can be displayed at once.
   * When the limit is exceeded, the oldest toasts are marked as `limited` (via the `data-limited`
   * attribute) rather than removed, so they can be hidden or animated out.
   * @default 3
   */
  limit?: number | undefined;
  /**
   * A global manager for toasts to use outside of a Solid component.
   */
  toastManager?: ToastManager | undefined;
}

export namespace ToastProvider {
  export type State = ToastProviderState;
  export type Props = ToastProviderProps;
}

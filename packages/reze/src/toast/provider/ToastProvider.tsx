import type { JSX } from "reze-js";
import { effect, onCleanup, untrack } from "reze-js";

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
    timeout: props.timeout ?? 5000,
    limit: props.limit ?? 3,
    viewport: null,
    toasts: [],
    hovering: false,
    focused: false,
    isWindowFocused: true,
    prevFocusElement: null,
  });

  effect(() => {
    onCleanup(store.dispose);
  });

  // `limit` needs custom syncing because changing it must also recompute each
  // toast's `limited` flag; syncing the raw value alone would not do that.
  effect(() => {
    const timeout = props.timeout ?? 5000;
    const limit = props.limit ?? 3;
    // One-shot write: the values only steer this sync and must not subscribe.
    untrack(() => {
      store.syncProviderProps(timeout, limit);
    });
  });

  const toastManager = props.toastManager;
  if (toastManager) {
    effect(() => {
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

      onCleanup(unsubscribe);
    });
  }

  // Deliberately not hoisted: reading `props.children` in this body would create
  // the children eagerly outside the provider below. Passed through nested JSX
  // they are created inside the context.
  return <ToastProviderContext value={store}>{props.children}</ToastProviderContext>;
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
   * A global manager for toasts to use outside of a Reze component.
   */
  toastManager?: ToastManager | undefined;
}

export namespace ToastProvider {
  export type State = ToastProviderState;
  export type Props = ToastProviderProps;
}

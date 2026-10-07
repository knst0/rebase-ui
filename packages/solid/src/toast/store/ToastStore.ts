import { type Accessor, createEffect, createSignal, type Setter } from "solid-js";

import { activeElement, contains, getTarget, matchesFocusVisible } from "../../internals/floating/utils/element";
import { ownerDocument } from "../../internals/utils/owner";
import type { ToastManagerAddOptions, ToastManagerPromiseOptions, ToastManagerUpdateOptions, ToastObject } from "../useToastManager";
import { generateId } from "../utils/generateId";
import { resolvePromiseOptions } from "../utils/resolvePromiseOptions";

type ToastInternalUpdateOptions<Data extends object> = Partial<Omit<ToastObject<Data>, "id" | "updateKey">>;

/**
 * A toast once it lives in the store. `addToast` is the only way in and it always
 * assigns `updateKey`, so unlike the public `ToastObject` it is never missing.
 */
export type StoredToast<Data extends object = any> = ToastObject<Data> & { updateKey: number };

export type ToastStoreState = {
  toasts: StoredToast[];
  toastMetadata: Map<string, ToastMetadata>;
  hovering: boolean;
  focused: boolean;
  timeout: number;
  limit: number;
  isWindowFocused: boolean;
  viewport: HTMLElement | null;
  prevFocusElement: HTMLElement | null;
};

type ToastMetadata = {
  value: StoredToast;
  domIndex: number;
  visibleIndex: number;
  offsetY: number;
};

type InitialState = Omit<ToastStoreState, "toastMetadata">;

function createToastMetadata(toasts: StoredToast[]) {
  const metadata = new Map<string, ToastMetadata>();
  let visibleIndex = 0;
  let offsetY = 0;

  toasts.forEach((toast, toastIndex) => {
    const isEnding = toast.transitionStatus === "ending";
    metadata.set(toast.id, {
      value: toast,
      domIndex: toastIndex,
      visibleIndex: isEnding ? -1 : visibleIndex,
      offsetY,
    });

    offsetY += toast.height || 0;

    if (!isEnding) {
      visibleIndex += 1;
    }
  });

  return metadata;
}

// Marks the active (non-ending) toasts beyond `limit` as limited. Callers pass
// toasts in newest-first order, so the newest `limit` toasts stay visible and
// the rest are flagged. Returns the same toast reference when its `limited`
// flag is unchanged to avoid unnecessary re-renders.
function applyLimited(toasts: StoredToast[], limit: number): StoredToast[] {
  let activeIndex = 0;
  return toasts.map((toast) => {
    if (toast.transitionStatus === "ending") {
      return toast;
    }
    const limited = activeIndex >= limit;
    activeIndex += 1;
    return toast.limited === limited ? toast : { ...toast, limited };
  });
}

export const toastStoreSelectors = {
  toasts: (state: ToastStoreState) => state.toasts,
  isEmpty: (state: ToastStoreState) => state.toasts.length === 0,
  toast: (state: ToastStoreState, id: string) => state.toastMetadata.get(id)?.value,
  toastIndex: (state: ToastStoreState, id: string) => state.toastMetadata.get(id)?.domIndex ?? -1,
  toastOffsetY: (state: ToastStoreState, id: string) => state.toastMetadata.get(id)?.offsetY ?? 0,
  toastVisibleIndex: (state: ToastStoreState, id: string) => state.toastMetadata.get(id)?.visibleIndex ?? -1,
  focused: (state: ToastStoreState) => state.focused,
  expanded: (state: ToastStoreState) => state.hovering || state.focused,
  expandedOrOutOfFocus: (state: ToastStoreState) => state.hovering || state.focused || !state.isWindowFocused,
  prevFocusElement: (state: ToastStoreState) => state.prevFocusElement,
  viewport: (state: ToastStoreState) => state.viewport,
};

export type ToastStoreSelectors = typeof toastStoreSelectors;

/**
 * A `setTimeout` with automatic cleanup. Framework-free port of the upstream
 * `Timeout` helper (`@base-ui/utils/useTimeout`): the store outlives any
 * component owner, so timers are cleared explicitly via `dispose`.
 */
class ToastTimeout {
  static create() {
    return new ToastTimeout();
  }

  private currentId: ReturnType<typeof setTimeout> | undefined;

  start(delay: number, fn: () => void) {
    this.clear();
    this.currentId = setTimeout(() => {
      this.currentId = undefined;
      fn();
    }, delay);
  }

  clear = () => {
    if (this.currentId !== undefined) {
      clearTimeout(this.currentId);
      this.currentId = undefined;
    }
  };
}

/**
 * Owns the list of toasts and their auto-dismiss timers. Uses the same
 * synchronous-snapshot + per-key version-signal pattern as `PopupStore`:
 * the plain-object `snapshot` is the single source of truth (Solid 2.0 batches
 * signal writes, while timer and interaction logic reads state synchronously
 * right after writing it), and one version signal per state key provides
 * granular reactivity.
 */
export class ToastStore {
  private snapshot: ToastStoreState;

  private readonly selectors = toastStoreSelectors;

  /**
   * One version signal per raw state key, created eagerly so their lifetime
   * matches the store (lazily created signals would be owned — and disposed —
   * by whichever computation first subscribed).
   */
  private readonly keyVersions = new Map<string, { get: Accessor<number>; set: Setter<number> }>();

  /**
   * Proxy over the snapshot that subscribes the enclosing computation to
   * exactly the raw fields the selector reads for the given arguments.
   * Values always come from the synchronous snapshot.
   */
  private readonly trackingSnapshot: ToastStoreState;

  private timers = new Map<string, TimerInfo>();

  private areTimersPaused = false;

  constructor(initialState: InitialState) {
    this.snapshot = {
      ...initialState,
      toastMetadata: createToastMetadata(initialState.toasts),
    };

    for (const key of Object.keys(this.snapshot)) {
      const [get, set] = createSignal(0, { ownedWrite: true });
      this.keyVersions.set(key, { get, set });
    }

    this.trackingSnapshot = new Proxy({} as ToastStoreState, {
      get: (_target, prop) => {
        if (typeof prop === "string") {
          this.trackKey(prop);
          return (this.snapshot as unknown as Record<string, unknown>)[prop];
        }
        return undefined;
      },
      has: (_target, prop) => Reflect.has(this.snapshot, prop),
      ownKeys: () => Reflect.ownKeys(this.snapshot),
      getOwnPropertyDescriptor: (_target, prop) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(this.snapshot, prop);
        if (descriptor !== undefined) {
          // The proxy target lacks the property, so the descriptor must be
          // configurable to satisfy proxy invariants.
          descriptor.configurable = true;
        }
        return descriptor;
      },
    });
  }

  private trackKey(key: string): void {
    let version = this.keyVersions.get(key);
    if (version === undefined) {
      const [get, set] = createSignal(0, { ownedWrite: true });
      version = { get, set };
      this.keyVersions.set(key, version);
    }
    version.get();
  }

  private bumpKey(key: string): void {
    this.keyVersions.get(key)?.set((prev) => prev + 1);
  }

  /**
   * The current state snapshot. Read inside a reactive computation to subscribe
   * to every key; prefer `select` for granular subscriptions.
   */
  get state(): ToastStoreState {
    for (const key of Object.keys(this.snapshot)) {
      this.trackKey(key);
    }
    return this.snapshot;
  }

  /**
   * Reads the current value for a state key through its selector. Values come
   * from the synchronous snapshot. Must only be called in a tracking scope
   * (compute function, JSX, memo); the computation subscribes only to the raw
   * fields the selector reads.
   */
  select = (key: string, arg?: any): any => {
    return (this.selectors[key as keyof ToastStoreSelectors] as (state: ToastStoreState, arg?: any) => unknown)(this.trackingSnapshot, arg);
  };

  /**
   * Reads the current value for a state key without subscribing (same selector
   * as `select`). Use in event handlers, emitter listeners, timeouts, and
   * effect apply callbacks — anywhere a one-shot read must not track.
   */
  peek = (key: string, arg?: any): any => {
    return (this.selectors[key as keyof ToastStoreSelectors] as (state: ToastStoreState, arg?: any) => unknown)(this.snapshot, arg);
  };

  /**
   * Returns the current snapshot without subscribing. Use for one-shot reads
   * that must not track (same guidance as `peek`).
   */
  peekState = (): ToastStoreState => {
    return this.snapshot;
  };

  /**
   * Returns a reactive accessor for a state key (same selector as `select`).
   */
  useState = (key: string, arg?: any): Accessor<any> => {
    return () => this.select(key, arg);
  };

  /**
   * Merges the provided changes into the current state, writing only when at
   * least one value changed. Mirrors `Store.update` upstream.
   */
  update = (changes: Partial<ToastStoreState>) => {
    const changed: Array<keyof ToastStoreState> = [];
    for (const key of Object.keys(changes) as Array<keyof ToastStoreState>) {
      if (!Object.is(this.snapshot[key], changes[key])) {
        changed.push(key);
      }
    }
    if (changed.length === 0) {
      return;
    }
    this.snapshot = { ...this.snapshot, ...changes };
    for (const key of changed) {
      this.bumpKey(key as string);
    }
  };

  /**
   * Sets a single state key when the value changed. Mirrors `Store.set`.
   */
  set = <Key extends keyof ToastStoreState>(key: Key, value: ToastStoreState[Key]) => {
    if (!Object.is(this.snapshot[key], value)) {
      this.snapshot = { ...this.snapshot, [key]: value };
      this.bumpKey(key as string);
    }
  };

  /**
   * Synchronizes a single external value into the store. The value is read
   * through `getValue` so updates stay reactive; the state snapshot itself is
   * written synchronously. Mirrors `ReactStore.useSyncedValue` upstream.
   */
  useSyncedValue = <Key extends keyof ToastStoreState>(key: Key, getValue: () => ToastStoreState[Key]) => {
    createEffect(
      () => getValue(),
      (value) => {
        if (!Object.is(this.snapshot[key], value)) {
          this.set(key, value);
        }
      },
    );
  };

  /**
   * Synchronizes several external values into the store. Mirrors
   * `ReactStore.useSyncedValues` upstream.
   */
  useSyncedValues = (getValues: () => Partial<ToastStoreState>) => {
    createEffect(
      () => getValues(),
      (values) => {
        this.update(values);
      },
    );
  };

  setViewport = (viewport: HTMLElement | null) => {
    this.set("viewport", viewport);
  };

  syncProviderProps(timeout: number, limit: number) {
    const snapshot = this.snapshot;
    const limitChanged = snapshot.limit !== limit;

    if (snapshot.timeout === timeout && !limitChanged) {
      return;
    }

    const updates = { timeout, limit } as Pick<ToastStoreState, "timeout" | "limit" | "toasts" | "toastMetadata">;

    if (limitChanged) {
      const newToasts = applyLimited(snapshot.toasts, limit);
      updates.toasts = newToasts;
      updates.toastMetadata = createToastMetadata(newToasts);
    }

    this.update(updates);
  }

  dispose = () => {
    this.timers.forEach((timer) => {
      timer.timeout?.clear();
    });
    this.timers.clear();
  };

  removeToast(toastId: string, skipOnRemove: boolean = false) {
    const snapshot = this.snapshot;
    const index = toastStoreSelectors.toastIndex(snapshot, toastId);
    if (index === -1) {
      return;
    }

    const toast = snapshot.toasts[index];
    if (!skipOnRemove) {
      toast?.onRemove?.();
    }

    const newToasts = [...snapshot.toasts];
    newToasts.splice(index, 1);
    this.setToasts(newToasts);
  }

  addToast = <Data extends object>(toast: ToastManagerAddOptions<Data>): string => {
    const snapshot = this.snapshot;
    const { timeout, limit } = snapshot;
    const id = toast.id || generateId("toast");

    if (toast.id) {
      const existingToast = toastStoreSelectors.toast(snapshot, toast.id);

      if (existingToast) {
        if (existingToast.transitionStatus === "ending") {
          this.removeToast(toast.id, true);
        } else {
          const { id: _id, transitionStatus: _transitionStatus, ...updates } = toast;
          this.updateToastInternal(toast.id, updates, true, true);
          return toast.id;
        }
      }
    }

    const toastToAdd: StoredToast<Data> = {
      ...toast,
      id,
      updateKey: 0,
      transitionStatus: "starting",
    };

    const updatedToasts = [toastToAdd, ...this.snapshot.toasts];
    this.setToasts(applyLimited(updatedToasts, limit));

    const duration = toastToAdd.timeout ?? timeout;
    if (toastToAdd.type !== "loading" && duration > 0) {
      this.scheduleTimer(id, duration, () => this.closeToast(id));
    }

    if (toastStoreSelectors.expandedOrOutOfFocus(this.snapshot)) {
      this.pauseTimers();
    }

    return id;
  };

  updateToast = <Data extends object>(
    id: string,
    updates: ToastManagerUpdateOptions<Data> | ((prevToast: ToastObject<Data>) => ToastManagerUpdateOptions<Data>),
  ) => {
    const prevToast = toastStoreSelectors.toast(this.snapshot, id);
    // Never run the updater for an update the store is going to ignore.
    if (!prevToast || prevToast.transitionStatus === "ending") {
      return;
    }

    // The updater may have called back into the store, so the internal update
    // reads the current state again.
    this.updateToastInternal(id, typeof updates === "function" ? updates(prevToast) : updates, false, true);
  };

  updateToastInternal = <Data extends object>(
    id: string,
    updates: ToastInternalUpdateOptions<Data>,
    resetTimer: boolean = false,
    markUpdated: boolean = false,
  ) => {
    const snapshot = this.snapshot;
    const { timeout, toasts } = snapshot;
    const prevToast = toastStoreSelectors.toast(snapshot, id);
    if (!prevToast) {
      return;
    }

    // Ignore updates for toasts that are already closing.
    // This prevents races where async updates (e.g. promise success/error)
    // can block a dismissal from completing.
    if (prevToast.transitionStatus === "ending") {
      return;
    }

    const nextToast: StoredToast<Data> = {
      ...prevToast,
      ...updates,
      ...(markUpdated && {
        updateKey: prevToast.updateKey + 1,
      }),
    };

    this.setToasts(toasts.map((toast) => (toast.id === id ? (nextToast as StoredToast) : toast)));

    const nextTimeout = nextToast.timeout ?? timeout;
    const prevTimeout = prevToast.timeout ?? timeout;

    const timeoutUpdated = Object.hasOwn(updates, "timeout");

    const shouldHaveTimer = nextToast.transitionStatus !== "ending" && nextToast.type !== "loading" && nextTimeout > 0;

    const hasTimer = this.timers.has(id);
    const timeoutChanged = prevTimeout !== nextTimeout;
    const wasLoading = prevToast.type === "loading";

    if (!shouldHaveTimer && hasTimer) {
      this.clearTimer(id);
      return;
    }

    // Schedule or reschedule timer if needed
    if (shouldHaveTimer && (!hasTimer || timeoutChanged || timeoutUpdated || wasLoading || resetTimer)) {
      this.clearTimer(id);

      this.scheduleTimer(id, nextTimeout, () => this.closeToast(id));

      if (toastStoreSelectors.expandedOrOutOfFocus(this.snapshot)) {
        this.pauseTimers();
      }
    }
  };

  closeToast = (toastId?: string) => {
    const closeAll = toastId === undefined;
    const snapshot = this.snapshot;
    const { limit, toasts } = snapshot;
    let toastsToClose: StoredToast[];

    if (closeAll) {
      toastsToClose = toasts;
      this.clearTimers();
    } else {
      const toast = toastStoreSelectors.toast(snapshot, toastId);
      if (!toast) {
        return;
      }
      toastsToClose = [toast];
      this.clearTimer(toastId);
    }

    const endingToasts = toasts.map((item) =>
      closeAll || item.id === toastId ? { ...item, transitionStatus: "ending" as const, height: 0 } : item,
    );
    const newToasts = applyLimited(endingToasts, limit);
    this.setToasts(newToasts, !newToasts.some((toast) => toast.transitionStatus !== "ending"));

    toastsToClose.forEach((toast) => {
      if (toast.transitionStatus !== "ending") {
        toast.onClose?.();
      }
    });

    this.handleFocusManagement(toastId);
  };

  promiseToast = <Value, Data extends object>(
    promiseValue: Promise<Value>,
    options: ToastManagerPromiseOptions<Value, Data>,
  ): Promise<Value> => {
    // Create a loading toast (which does not auto-dismiss).
    const loadingOptions = resolvePromiseOptions(options.loading);
    const id = this.addToast({
      ...loadingOptions,
      type: "loading",
    });

    const handledPromise = promiseValue
      .then((result: Value) => {
        const successOptions = resolvePromiseOptions(options.success, result);
        this.updateToast(id, {
          ...successOptions,
          type: "success",
          timeout: successOptions.timeout,
        });

        return result;
      })
      .catch((error) => {
        const errorOptions = resolvePromiseOptions(options.error, error);
        this.updateToast(id, {
          ...errorOptions,
          type: "error",
          timeout: errorOptions.timeout,
        });

        return Promise.reject(error);
      });

    // Private API used exclusively by `Manager` to handoff the promise
    // back to the manager after it's handled here.
    if ({}.hasOwnProperty.call(options, "setPromise")) {
      (options as any).setPromise(handledPromise);
    }

    return handledPromise;
  };

  pauseTimers() {
    if (this.areTimersPaused) {
      return;
    }
    this.areTimersPaused = true;
    this.timers.forEach((timer) => {
      // Timers added while already paused have no running timeout, so their
      // `remaining` is still the full delay and must be left alone.
      if (timer.timeout) {
        timer.timeout.clear();
        // `start` is stamped on every resume, so subtracting from `remaining`
        // (rather than from the original delay) keeps repeated pause/resume
        // cycles from handing the toast extra time.
        timer.remaining = Math.max(timer.remaining - (Date.now() - timer.start), 0);
      }
    });
  }

  resumeTimers() {
    if (!this.areTimersPaused) {
      return;
    }
    this.areTimersPaused = false;
    this.timers.forEach((timer, id) => {
      timer.remaining = timer.remaining > 0 ? timer.remaining : timer.delay;
      timer.timeout ??= ToastTimeout.create();
      timer.timeout.start(timer.remaining, () => {
        this.handleTimerFired(id);
        timer.callback();
      });
      timer.start = Date.now();
    });
  }

  restoreFocusToPrevElement() {
    this.snapshot.prevFocusElement?.focus({ preventScroll: true });
  }

  handleDocumentPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") {
      return;
    }

    const target = getTarget(event) as Element | null;
    if (contains(this.snapshot.viewport, target)) {
      return;
    }

    // This is explicit touch activity outside the viewport, so the paused
    // interaction state should end even if the window focus state is unchanged.
    this.resumeTimers();
    this.update({ hovering: false, focused: false });
  };

  private scheduleTimer(id: string, delay: number, callback: () => void) {
    const start = Date.now();
    const shouldStartActive = !toastStoreSelectors.expandedOrOutOfFocus(this.snapshot);
    const currentTimeout = shouldStartActive ? ToastTimeout.create() : undefined;

    currentTimeout?.start(delay, () => {
      this.handleTimerFired(id);
      callback();
    });

    this.timers.set(id, {
      timeout: currentTimeout,
      start,
      delay,
      remaining: delay,
      callback,
    });
  }

  private clearTimers() {
    this.timers.forEach((timer) => {
      timer.timeout?.clear();
    });
    this.timers.clear();
    this.areTimersPaused = false;
  }

  private clearTimer(id: string) {
    const timer = this.timers.get(id);
    timer?.timeout?.clear();
    this.timers.delete(id);

    this.resetPausedStateIfNoTimersRemain();
  }

  private handleTimerFired(id: string) {
    this.timers.delete(id);
    this.resetPausedStateIfNoTimersRemain();
  }

  private resetPausedStateIfNoTimersRemain() {
    if (this.timers.size === 0) {
      // No timers remain to keep paused; clear the flag so a fresh toast's
      // running timer can be paused again on hover/focus.
      this.areTimersPaused = false;
    }
  }

  private setToasts(newToasts: StoredToast[], clearInteraction: boolean = newToasts.length === 0) {
    const updates = {
      toasts: newToasts,
      toastMetadata: createToastMetadata(newToasts),
    } as Pick<ToastStoreState, "toasts" | "toastMetadata" | "hovering" | "focused">;

    if (clearInteraction) {
      updates.hovering = false;
      updates.focused = false;
    }

    this.update(updates);
  }

  private handleFocusManagement(toastId: string | undefined) {
    const snapshot = this.snapshot;
    const activeEl = activeElement(ownerDocument(snapshot.viewport));
    if (!snapshot.viewport || !contains(snapshot.viewport, activeEl) || !matchesFocusVisible(activeEl)) {
      return;
    }

    if (toastId === undefined) {
      this.restoreFocusToPrevElement();
      return;
    }

    const toasts = toastStoreSelectors.toasts(snapshot);
    const currentIndex = toastStoreSelectors.toastIndex(snapshot, toastId);

    const scan = (from: number, step: number) => {
      for (let index = from; index >= 0 && index < toasts.length; index += step) {
        if (toasts[index].transitionStatus !== "ending") {
          return toasts[index];
        }
      }
      return null;
    };

    // Try to find the next toast that isn't animating out, then fall back to the previous one.
    const nextToast = scan(currentIndex + 1, 1) ?? scan(currentIndex - 1, -1);

    if (nextToast) {
      nextToast.ref?.current?.focus();
    } else {
      this.restoreFocusToPrevElement();
    }
  }
}

interface TimerInfo {
  timeout?: ToastTimeout | undefined;
  /** Timestamp of the last time the timeout started running. */
  start: number;
  /** Full timeout duration, used to restart a timer that elapsed while throttled. */
  delay: number;
  /** Time left before the toast auto-dismisses, excluding any paused time. */
  remaining: number;
  callback: () => void;
}

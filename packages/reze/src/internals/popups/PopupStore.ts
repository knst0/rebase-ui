import { effect, store as createStore, untrack } from "reze-js";

import type { PopupStoreContext, PopupStoreSelectorKey, PopupStoreState } from "./popupStoreState";
import { popupStoreSelectors } from "./popupStoreState";

export type PopupStoreSelectorMap<State extends PopupStoreState<unknown>> = {
  [Key in PopupStoreSelectorKey]: (state: State, arg?: any) => unknown;
} & Record<string, (state: State, arg?: any) => unknown>;

/**
 * Base class for popup stores (tooltip, popover, menu, ...).
 * Mirrors upstream `ReactStore` + `utils/popups/store.ts` selectors, using the same
 * synchronous-snapshot + per-key version-signal pattern as `FloatingRootStore`:
 * the plain-object `snapshot` is the single source of truth (store writes must be
 * visible to synchronous reads right after writing, while interaction logic reads
 * state synchronously), and one version counter per state key provides granular
 * reactivity: a `select` computation only re-runs when a raw field its selector
 * actually read changes, instead of on every store write.
 */
export class PopupStore<
  State extends PopupStoreState<unknown> = PopupStoreState<unknown>,
  Selectors extends PopupStoreSelectorMap<State> = PopupStoreSelectorMap<State>,
  Context extends PopupStoreContext<any> = PopupStoreContext<any>,
> {
  readonly context: Context;

  protected snapshot: State;

  private readonly selectors: Selectors;

  /**
   * One version counter per state key, created eagerly so every key is
   * reactive from construction. Counters live in a single store object whose
   * fields are read per-key, so each subscriber tracks only its own key.
   */
  private readonly keyVersions: Record<string, number>;

  /**
   * Proxy over the snapshot that subscribes the enclosing computation to
   * exactly the raw fields the selector reads for the given arguments.
   * Values always come from the synchronous snapshot.
   */
  private readonly trackingSnapshot: State;

  constructor(initialState: State, context: Context, selectors: Selectors) {
    this.snapshot = initialState;
    this.context = context;
    this.selectors = selectors;

    this.keyVersions = createStore(Object.fromEntries(Object.keys(initialState).map((key) => [key, 0])) as Record<string, number>);

    this.trackingSnapshot = new Proxy({} as State, {
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
    this.keyVersions[key] ??= 0;
    // The read subscribes the enclosing computation in a tracking scope;
    // one-shot readers just get the current value.
    void this.keyVersions[key];
  }

  private bumpKey(key: string): void {
    // Actions never subscribe: without untrack, the read half of += inside an
    // effect would subscribe the effect to the version it writes (self-loop).
    untrack(() => {
      this.keyVersions[key] = (this.keyVersions[key] ?? 0) + 1;
    });
  }

  /**
   * The current state snapshot. Read inside a reactive computation to subscribe
   * to every key; prefer `select` for granular subscriptions.
   */
  get state(): State {
    for (const key of Object.keys(this.snapshot)) {
      this.trackKey(key);
    }
    return this.snapshot;
  }

  /**
   * Reads the current value for a state key through its selector. Reads must go through
   * the snapshot (never through signals) so synchronous interaction logic observes fresh writes.
   * Stringly-keyed like upstream `Store.select`; cast results at call sites.
   * Must only be called in a tracking scope (effect, JSX, derived reader); the
   * computation subscribes only to the raw fields the selector reads.
   */
  select = (key: string, arg?: any): any => {
    return (this.selectors[key] as (state: State, arg?: any) => unknown)(this.trackingSnapshot, arg);
  };

  /**
   * Reads the current value for a state key without subscribing (same selector
   * as `select`). Use in event handlers, emitter listeners, timeouts, and
   * untracked effect continuations — anywhere a one-shot read must not track.
   */
  peek = (key: string, arg?: any): any => {
    return (this.selectors[key] as (state: State, arg?: any) => unknown)(this.snapshot, arg);
  };

  /**
   * Returns the current snapshot without subscribing. Use for one-shot reads
   * that must not track (same guidance as `peek`).
   */
  peekState = (): State => {
    return this.snapshot;
  };

  /**
   * Returns a reactive accessor for a state key (same selector as `select`).
   */
  useState = (key: string, arg?: any): (() => any) => {
    return () => this.select(key, arg);
  };

  /**
   * Merges the provided changes into the current state, writing only when at
   * least one value changed. Mirrors `Store.update` upstream.
   */
  update = (changes: Partial<State>) => {
    const changed: Array<keyof State> = [];
    for (const key of Object.keys(changes) as Array<keyof State>) {
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
  set = <Key extends keyof State>(key: Key, value: State[Key]) => {
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
  useSyncedValue = <Key extends keyof State>(key: Key, getValue: () => State[Key]) => {
    effect(() => {
      const value = getValue();
      // One-shot write: the comparison and the write steer this sync only and
      // must not subscribe the effect to the store.
      untrack(() => {
        if (this.snapshot[key] !== value) {
          this.set(key, value);
        }
      });
    });
  };

  /**
   * Synchronizes several external values into the store. Mirrors
   * `ReactStore.useSyncedValues` upstream.
   */
  useSyncedValues = (getValues: () => Partial<State>) => {
    effect(() => {
      const values = getValues();
      // One-shot write: the values only steer this sync and must not subscribe.
      untrack(() => {
        this.update(values);
      });
    });
  };
}

export { popupStoreSelectors };
export type { PopupStoreState, PopupStoreContext };

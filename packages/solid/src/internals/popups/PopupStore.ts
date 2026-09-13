import { type Accessor, createEffect, createSignal, type Setter } from "solid-js";

import type { PopupStoreContext, PopupStoreSelectorKey, PopupStoreState } from "./popupStoreState";
import { popupStoreSelectors } from "./popupStoreState";

export type PopupStoreSelectorMap<State extends PopupStoreState<unknown>> = {
  [Key in PopupStoreSelectorKey]: (state: State, arg?: any) => unknown;
} & Record<string, (state: State, arg?: any) => unknown>;

/**
 * Base class for popup stores (tooltip, popover, menu, ...).
 * Mirrors upstream `ReactStore` + `utils/popups/store.ts` selectors, using the same
 * synchronous-snapshot + per-key version-signal pattern as `FloatingRootStore`:
 * the plain-object `snapshot` is the single source of truth (Solid 2.0 batches
 * signal writes, while interaction logic reads state synchronously right after
 * writing it), and one version signal per state key provides granular reactivity:
 * a `select` computation only re-runs when a raw field its selector actually read
 * changes, instead of on every store write.
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
  private readonly trackingSnapshot: State;

  constructor(initialState: State, context: Context, selectors: Selectors) {
    this.snapshot = initialState;
    this.context = context;
    this.selectors = selectors;

    for (const key of Object.keys(initialState)) {
      const [get, set] = createSignal(0, { ownedWrite: true });
      this.keyVersions.set(key, { get, set });
    }

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
   * Must only be called in a tracking scope (compute function, JSX, memo); the
   * computation subscribes only to the raw fields the selector reads.
   */
  select = (key: string, arg?: any): any => {
    return (this.selectors[key] as (state: State, arg?: any) => unknown)(this.trackingSnapshot, arg);
  };

  /**
   * Reads the current value for a state key without subscribing (same selector
   * as `select`). Use in event handlers, emitter listeners, timeouts, and
   * effect apply callbacks — anywhere a one-shot read must not track.
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
  useState = (key: string, arg?: any): Accessor<any> => {
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
  useSyncedValues = (getValues: () => Partial<State>) => {
    createEffect(
      () => getValues(),
      (values) => {
        this.update(values);
      },
    );
  };
}

export { popupStoreSelectors };
export type { PopupStoreState, PopupStoreContext };

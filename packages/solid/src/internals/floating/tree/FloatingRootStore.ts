import { type Accessor, createEffect, createSignal, type Setter } from "solid-js";

import type { RebaseUIChangeEventDetails } from "../../event-details/createEventDetails";
import type { TransitionStatus } from "../../transition-status/createTransitionStatus";
import type { ContextData, FloatingEvents, FloatingUIOpenChangeDetails, ReferenceType, TriggerElementsMap } from "../types";
import { createEventEmitter } from "../utils/createEventEmitter";
import { isClickLikeEvent } from "../utils/event";

export interface FloatingRootState {
  open: boolean;
  transitionStatus: TransitionStatus | undefined;
  domReferenceElement: Element | null;
  referenceElement: ReferenceType | null;
  floatingElement: HTMLElement | null;
  positionReference: ReferenceType | null;
  /**
   * The ID of the floating element.
   */
  floatingId: string | undefined;
}

export interface FloatingRootStoreContext {
  onOpenChange: ((open: boolean, eventDetails: RebaseUIChangeEventDetails<string>) => void) | undefined;
  readonly dataRef: { current: ContextData };
  readonly events: FloatingEvents;
  nested: boolean;
  readonly triggerElements: TriggerElementsMap;
}

export type FloatingRootStateKey =
  | "open"
  | "transitionStatus"
  | "domReferenceElement"
  | "referenceElement"
  | "floatingElement"
  | "floatingId";

export interface FloatingRootStoreOptions {
  open: boolean;
  transitionStatus: TransitionStatus | undefined;
  referenceElement: ReferenceType | null;
  floatingElement: HTMLElement | null;
  triggerElements: TriggerElementsMap;
  floatingId: string | undefined;
  /**
   * When true, `setOpen` only forwards to `onOpenChange`.
   * The popup store owns `dispatchOpenChange(...)` in this mode.
   */
  syncOnly: boolean;
  nested: boolean;
  onOpenChange: ((open: boolean, eventDetails: RebaseUIChangeEventDetails<string>) => void) | undefined;
}

export class FloatingRootStore {
  private readonly syncOnly: boolean;

  readonly context: FloatingRootStoreContext;

  /**
   * Synchronous source of truth, mirroring upstream's plain `this.state`.
   * Signal writes in Solid 2.0 are microtask-batched, so interaction logic that
   * reads state right after writing it (e.g. `syncOpenEvent`) cannot rely on a
   * signal alone. Reactivity is provided by one version signal per state key
   * below, so a `select` computation only re-runs when a field it actually read
   * changes instead of on every store write.
   */
  private snapshot: FloatingRootState;

  /**
   * One version signal per state key, created eagerly so their lifetime matches
   * the store (lazily created signals would be owned — and disposed — by
   * whichever computation first subscribed).
   */
  private readonly keyVersions = new Map<string, { get: Accessor<number>; set: Setter<number> }>();

  /**
   * Proxy over the snapshot that subscribes the enclosing computation to
   * exactly the fields the key resolution reads. Values always come from the
   * synchronous snapshot.
   */
  private readonly trackingSnapshot: FloatingRootState;

  constructor(options: FloatingRootStoreOptions) {
    const { syncOnly, nested, onOpenChange, triggerElements, ...initialState } = options;

    this.snapshot = {
      ...initialState,
      positionReference: initialState.referenceElement,
      domReferenceElement: initialState.referenceElement as Element | null,
    };

    for (const key of Object.keys(this.snapshot)) {
      const [get, set] = createSignal(0, { ownedWrite: true });
      this.keyVersions.set(key, { get, set });
    }

    this.trackingSnapshot = new Proxy({} as FloatingRootState, {
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

    this.context = {
      onOpenChange,
      dataRef: { current: {} },
      events: createEventEmitter(),
      nested,
      triggerElements,
    };

    this.syncOnly = syncOnly;
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
  get state(): FloatingRootState {
    for (const key of Object.keys(this.snapshot)) {
      this.trackKey(key);
    }
    return this.snapshot;
  }

  /**
   * Applies a partial state update. Called by the owning floating hook;
   * `setOpen` intentionally does not write state (the owner syncs it).
   * Only keys whose value changed notify their subscribers.
   */
  updateState = (next: Partial<FloatingRootState>) => {
    const prev = this.snapshot;
    this.snapshot = { ...prev, ...next };
    for (const key of Object.keys(next) as Array<keyof FloatingRootState>) {
      if (!Object.is(prev[key], this.snapshot[key])) {
        this.bumpKey(key);
      }
    }
  };

  /**
   * Merges the provided changes into the current state, writing only when at
   * least one value changed. Mirrors `Store.update` upstream; each value must
   * match its state key.
   */
  update = (changes: Partial<FloatingRootState>) => {
    const changed: Array<keyof FloatingRootState> = [];
    for (const key of Object.keys(changes) as Array<keyof FloatingRootState>) {
      if (!Object.is(this.snapshot[key], changes[key])) {
        changed.push(key);
      }
    }
    if (changed.length === 0) {
      return;
    }
    this.snapshot = { ...this.snapshot, ...changes };
    for (const key of changed) {
      this.bumpKey(key);
    }
  };

  /**
   * Sets a single state key when the value changed. Mirrors `Store.set`.
   */
  set = <Key extends keyof FloatingRootState>(key: Key, value: FloatingRootState[Key]) => {
    if (!Object.is(this.snapshot[key], value)) {
      this.snapshot = { ...this.snapshot, [key]: value };
      this.bumpKey(key);
    }
  };

  /**
   * Synchronizes a single external value into the store. The value is read
   * through `getValue` so updates stay reactive; the state snapshot itself is
   * written synchronously. Mirrors `ReactStore.useSyncedValue` upstream.
   */
  useSyncedValue = <Key extends keyof FloatingRootState>(key: Key, getValue: () => FloatingRootState[Key]) => {
    createEffect(
      () => getValue(),
      (value) => {
        if (this.snapshot[key] !== value) {
          this.set(key, value);
        }
      },
    );
  };

  private resolveKey = <Key extends FloatingRootStateKey>(state: FloatingRootState, key: Key): FloatingRootState[Key] => {
    if (key === "referenceElement") {
      return (state.positionReference ?? state.referenceElement) as FloatingRootState[Key];
    }
    return state[key];
  };

  /**
   * Reads the current value for a state key. `referenceElement` resolves the
   * `positionReference ?? referenceElement` selector, mirroring upstream.
   * Must only be called in a tracking scope (compute function, JSX, memo); the
   * computation subscribes only to the fields the resolution reads.
   */
  select = <Key extends FloatingRootStateKey>(key: Key): FloatingRootState[Key] => {
    return this.resolveKey(this.trackingSnapshot, key);
  };

  /**
   * Reads the current value for a state key without subscribing (same selector
   * as `select`). Use in event handlers, emitter listeners, timeouts, and
   * effect apply callbacks — anywhere a one-shot read must not track. Reading
   * `select` in those scopes warns under Solid 2.0 strict mode
   * (`STRICT_READ_UNTRACKED`) because the read never subscribes.
   */
  peek = <Key extends FloatingRootStateKey>(key: Key): FloatingRootState[Key] => {
    return this.resolveKey(this.snapshot, key);
  };

  /**
   * Returns the current snapshot without subscribing. Use for one-shot reads
   * that must not track (same guidance as `peek`).
   */
  peekState = (): FloatingRootState => {
    return this.snapshot;
  };

  /**
   * Returns a reactive accessor for a state key (same selector as `select`).
   */
  useState = <Key extends FloatingRootStateKey>(key: Key): Accessor<FloatingRootState[Key]> => {
    return () => this.select(key);
  };

  /**
   * Syncs the event used by hover logic to distinguish hover-open from click-like interaction.
   */
  syncOpenEvent = (newOpen: boolean, event: Event | undefined) => {
    if (
      !newOpen ||
      !this.snapshot.open ||
      // Prevent a pending hover-open from overwriting a click-open event, while allowing
      // click events to upgrade a hover-open.
      (event != null && isClickLikeEvent(event))
    ) {
      this.context.dataRef.current.openEvent = newOpen ? event : undefined;
    }
  };

  /**
   * Runs the root-owned side effects for an open state change.
   */
  dispatchOpenChange = (newOpen: boolean, eventDetails: RebaseUIChangeEventDetails<string>) => {
    this.syncOpenEvent(newOpen, eventDetails.event as Event | undefined);

    const details: FloatingUIOpenChangeDetails = {
      open: newOpen,
      reason: eventDetails.reason,
      nativeEvent: eventDetails.event as Event,
      nested: this.context.nested,
      triggerElement: eventDetails.trigger,
    };

    this.context.events.emit("openchange", details);
  };

  /**
   * Emits the `openchange` event through the internal event emitter and calls the `onOpenChange` handler with the provided arguments.
   *
   * @param newOpen The new open state.
   * @param eventDetails Details about the event that triggered the open state change.
   */
  setOpen = (newOpen: boolean, eventDetails: RebaseUIChangeEventDetails<string>) => {
    if (this.syncOnly) {
      this.context.onOpenChange?.(newOpen, eventDetails);
      return;
    }

    this.dispatchOpenChange(newOpen, eventDetails);

    this.context.onOpenChange?.(newOpen, eventDetails);
  };
}

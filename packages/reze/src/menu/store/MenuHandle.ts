import { store, untrack } from "reze-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { MenuStore } from "./MenuStore";

export type AttachedMenuRoot<Payload = unknown> = MenuStore<Payload>;

/**
 * Controls a Menu imperatively and associates detached `Menu.Trigger` components with a
 * `Menu.Root`. Create one with `Menu.createHandle()` and pass it to the `handle` prop of the
 * root and of any triggers rendered outside of it.
 *
 * The imperative methods take effect only while a root using this handle is mounted; calls made
 * before a root attaches (or after it unmounts) are ignored.
 */
export class MenuHandle<Payload = unknown> {
  // Nominal brand: makes this handle type distinct from sibling handles so they
  // can't be passed interchangeably. Type-only; has no runtime presence.
  private readonly __menuBrand!: never;

  private attachedRoot: AttachedMenuRoot<Payload> | null = null;
  private readonly attachedState = store({ version: 0 });
  private readonly pendingTriggers = new Map<string, Element>();

  /**
   * Opens the menu and associates it with the trigger with the given id.
   *
   * This method should only be called in an event handler or an effect (not during rendering).
   *
   * @param triggerId ID of the trigger to associate with the menu. The trigger must be a matching
   * `Menu.Trigger` with this handle passed as a prop.
   */
  open(triggerId: string): void {
    const attached = this.attachedRoot;

    if (attached === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Rebase UI: MenuHandle.open() was called while no root using this handle is mounted. " +
            "The call was ignored; mount a root with this handle before opening it imperatively.",
        );
      }
      return;
    }

    let triggerElement = attached.context.triggerElements.getById(triggerId) ?? this.pendingTriggers.get(triggerId);

    if (!triggerElement && typeof document !== "undefined") {
      // Synchronous post-mount fallback: reze populates element refs (and therefore the
      // trigger registry) after the initial effect flush, so an imperative `open()` issued in
      // the same task as mount finds an empty registry even though the trigger element already
      // exists in the DOM. Resolving by id restores the contract; the registration effects
      // settle on the next flush. A genuinely unknown id still falls through to the throw below.
      triggerElement = document.getElementById(triggerId) ?? undefined;
    }

    if (!triggerElement) {
      throw new Error(
        "Rebase UI: MenuHandle.open() was called with the trigger id " +
          `"${triggerId}", but no matching trigger is registered with this handle. ` +
          "An anchored popup cannot open without a trigger to anchor to. " +
          'Pass the id of a mounted Menu.Trigger that has this handle set on its "handle" prop.',
      );
    }

    attached.setOpen(true, createChangeEventDetails(REASONS.imperativeAction, undefined, triggerElement));
  }

  /**
   * Closes the menu.
   *
   * This method should only be called in an event handler or an effect (not during rendering).
   */
  close(): void {
    const attached = this.attachedRoot;

    if (attached === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Rebase UI: MenuHandle.close() was called while no root using this handle is mounted. " + "The call was ignored.");
      }
      return;
    }

    attached.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
  }

  /**
   * Whether the menu is currently open. Returns `false` while no root is attached to the handle.
   */
  get isOpen(): boolean {
    return this.attached?.select("open") ?? false;
  }

  /**
   * The currently attached root, if any. Reactive: detached triggers use it
   * to follow the root even when it mounts after them.
   */
  get attached(): AttachedMenuRoot<Payload> | null {
    // The root keeps its identity: it lives outside the store (which would proxy-wrap
    // it) and the store only carries a version counter that readers subscribe to.
    void this.attachedState.version;
    return this.attachedRoot;
  }

  /**
   * Attaches a root to this handle. Called by `Menu.Root`.
   */
  attach(root: AttachedMenuRoot<Payload>): void {
    this.attachedRoot = root;
    // Actions never subscribe: without untrack, the read half of += inside the
    // root's attach effect would subscribe that effect to this version counter.
    untrack(() => {
      this.attachedState.version += 1;
    });
    // Pending triggers are intentionally NOT cleared here: a trigger that mounted before this
    // root attached registers pending, and its migration into the live store runs as an effect
    // cascade that may not have settled when an imperative `open()` follows synchronously.
    // Each trigger's effect cleanup removes its own pending entry once it migrates.
  }

  /**
   * Detaches a root from this handle. Called by `Menu.Root` on cleanup.
   */
  detach(root: AttachedMenuRoot<Payload>): void {
    if (this.attachedRoot === root) {
      this.attachedRoot = null;
      // Actions never subscribe (see attach).
      untrack(() => {
        this.attachedState.version += 1;
      });
    }
  }

  /** @internal Registers a trigger that mounted before any root attached. */
  registerPendingTrigger(id: string, element: Element): () => void {
    this.pendingTriggers.set(id, element);

    return () => {
      if (this.pendingTriggers.get(id) === element) {
        this.pendingTriggers.delete(id);
      }
    };
  }
}

/**
 * Creates a new handle to connect a Menu.Root with detached Menu.Trigger components.
 */
export function createMenuHandle<Payload = unknown>(): MenuHandle<Payload> {
  return new MenuHandle<Payload>();
}
